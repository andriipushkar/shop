package onboarding

import (
	"context"
	"errors"
	"testing"
)

// MockDNSProvider for testing
type MockDNSProvider struct {
	subdomains   map[string]string
	cnames       map[string]string
	verifiedDomains map[string]bool
}

func NewMockDNSProvider() *MockDNSProvider {
	return &MockDNSProvider{
		subdomains:   make(map[string]string),
		cnames:       make(map[string]string),
		verifiedDomains: make(map[string]bool),
	}
}

func (m *MockDNSProvider) CreateSubdomain(ctx context.Context, subdomain, baseDomain, targetIP string) error {
	key := subdomain + "." + baseDomain
	m.subdomains[key] = targetIP
	return nil
}

func (m *MockDNSProvider) CreateCNAME(ctx context.Context, customDomain, targetDomain string) error {
	m.cnames[customDomain] = targetDomain
	return nil
}

func (m *MockDNSProvider) VerifyDomain(ctx context.Context, domain string) (bool, error) {
	return m.verifiedDomains[domain], nil
}

func (m *MockDNSProvider) DeleteSubdomain(ctx context.Context, subdomain, baseDomain string) error {
	key := subdomain + "." + baseDomain
	delete(m.subdomains, key)
	return nil
}

// MockCertificateProvider for testing
type MockCertificateProvider struct {
	certificates map[string]string
}

func NewMockCertificateProvider() *MockCertificateProvider {
	return &MockCertificateProvider{
		certificates: make(map[string]string),
	}
}

func (m *MockCertificateProvider) RequestCertificate(ctx context.Context, domains []string) (string, error) {
	certID := "cert-" + domains[0]
	m.certificates[certID] = "pending"
	return certID, nil
}

func (m *MockCertificateProvider) GetCertificateStatus(ctx context.Context, certID string) (string, error) {
	if status, ok := m.certificates[certID]; ok {
		return status, nil
	}
	return "", errors.New("certificate not found")
}

// MockUserService for testing
type MockUserService struct {
	users    map[string]string
	roles    map[string][]string
	apiKeys  map[string]string
}

func NewMockUserService() *MockUserService {
	return &MockUserService{
		users:   make(map[string]string),
		roles:   make(map[string][]string),
		apiKeys: make(map[string]string),
	}
}

func (m *MockUserService) CreateUser(ctx context.Context, email, password, name, phone string) (string, error) {
	userID := "user-" + email
	m.users[userID] = email
	return userID, nil
}

func (m *MockUserService) AssignRole(ctx context.Context, userID, tenantID, role string) error {
	key := userID + ":" + tenantID
	m.roles[key] = append(m.roles[key], role)
	return nil
}

func (m *MockUserService) GenerateAPIKeys(ctx context.Context, tenantID string) (apiKey, secretKey string, err error) {
	apiKey = GenerateAPIKey()
	secretKey = GenerateSecretKey()
	m.apiKeys[tenantID] = apiKey
	return apiKey, secretKey, nil
}

// MockTenantService for testing
type MockTenantService struct {
	tenants map[string]*Tenant
}

func NewMockTenantService() *MockTenantService {
	return &MockTenantService{
		tenants: make(map[string]*Tenant),
	}
}

func (m *MockTenantService) Create(ctx context.Context, input CreateTenantInput) (*Tenant, error) {
	tenant := &Tenant{
		ID:   "tenant-" + input.Slug,
		Slug: input.Slug,
	}
	m.tenants[input.Slug] = tenant
	return tenant, nil
}

func (m *MockTenantService) GetBySlug(ctx context.Context, slug string) (*Tenant, error) {
	if tenant, ok := m.tenants[slug]; ok {
		return tenant, nil
	}
	return nil, errors.New("tenant not found")
}

// MockBillingService for testing
type MockBillingService struct {
	subscriptions map[string]string
	promoCodes    map[string]bool
}

func NewMockBillingService() *MockBillingService {
	return &MockBillingService{
		subscriptions: make(map[string]string),
		promoCodes:    make(map[string]bool),
	}
}

func (m *MockBillingService) CreateSubscription(ctx context.Context, tenantID, planID, period string) error {
	m.subscriptions[tenantID] = planID
	return nil
}

func (m *MockBillingService) ApplyPromoCode(ctx context.Context, tenantID, promoCode string) error {
	m.promoCodes[tenantID] = true
	return nil
}

// MockNotificationService for testing
type MockNotificationService struct {
	emails []string
	admins []string
}

func NewMockNotificationService() *MockNotificationService {
	return &MockNotificationService{
		emails: make([]string, 0),
		admins: make([]string, 0),
	}
}

func (m *MockNotificationService) SendWelcomeEmail(ctx context.Context, email string, data WelcomeEmailData) error {
	m.emails = append(m.emails, email)
	return nil
}

func (m *MockNotificationService) SendAdminNotification(ctx context.Context, message string) error {
	m.admins = append(m.admins, message)
	return nil
}

// MockAnalyticsService for testing
type MockAnalyticsService struct {
	signups []string
}

func NewMockAnalyticsService() *MockAnalyticsService {
	return &MockAnalyticsService{
		signups: make([]string, 0),
	}
}

func (m *MockAnalyticsService) TrackSignup(ctx context.Context, tenantID string, metadata map[string]interface{}) error {
	m.signups = append(m.signups, tenantID)
	return nil
}

// ==================== TESTS ====================

func TestOnboardingService_ProcessOnboarding(t *testing.T) {
	dns := NewMockDNSProvider()
	cert := NewMockCertificateProvider()
	users := NewMockUserService()
	tenants := NewMockTenantService()
	billing := NewMockBillingService()
	notifications := NewMockNotificationService()
	analytics := NewMockAnalyticsService()

	service := NewOnboardingService(
		dns, cert, users, tenants, billing, notifications, analytics,
		Config{
			BaseDomain:  "shop.com",
			TargetIP:    "1.2.3.4",
			AdminDomain: "admin.shop.com",
		},
	)

	req := OnboardingRequest{
		OwnerEmail:    "owner@example.com",
		OwnerName:     "John Doe",
		OwnerPhone:    "+380991234567",
		OwnerPassword: "securepassword123",
		StoreName:     "My Awesome Store",
		StoreSlug:     "my-awesome-store",
		StoreCategory: "electronics",
		PlanID:        "starter",
		BillingPeriod: "monthly",
	}

	result, err := service.ProcessOnboarding(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result.Slug != "my-awesome-store" {
		t.Errorf("expected slug my-awesome-store, got %s", result.Slug)
	}

	if result.Domain != "my-awesome-store.shop.com" {
		t.Errorf("expected domain my-awesome-store.shop.com, got %s", result.Domain)
	}

	if result.APIKey == "" {
		t.Error("expected API key to be generated")
	}

	// Check DNS was created
	if _, ok := dns.subdomains["my-awesome-store.shop.com"]; !ok {
		t.Error("expected subdomain to be created")
	}

	// Check subscription was created
	if billing.subscriptions[result.TenantID] != "starter" {
		t.Error("expected subscription to be created")
	}

	// Check welcome email was sent
	if len(notifications.emails) != 1 || notifications.emails[0] != "owner@example.com" {
		t.Error("expected welcome email to be sent")
	}

	// Check analytics was tracked
	if len(analytics.signups) != 1 {
		t.Error("expected signup to be tracked")
	}
}

func TestOnboardingService_ValidateSlug(t *testing.T) {
	service := &OnboardingService{baseDomain: "shop.com"}

	tests := []struct {
		slug      string
		shouldErr bool
	}{
		{"my-store", false},
		{"store123", false},
		{"a-b-c", false},
		{"ab", true},                    // too short
		{"-invalid", true},              // starts with hyphen
		{"invalid-", true},              // ends with hyphen
		{"UPPERCASE", true},             // uppercase
		{"with spaces", true},           // spaces
		{"special!chars", true},         // special characters
		{"admin", true},                 // reserved
		{"api", true},                   // reserved
		{"www", true},                   // reserved
	}

	for _, tt := range tests {
		t.Run(tt.slug, func(t *testing.T) {
			err := service.validateSlug(tt.slug)
			if tt.shouldErr && err == nil {
				t.Errorf("expected error for slug %s", tt.slug)
			}
			if !tt.shouldErr && err != nil {
				t.Errorf("unexpected error for slug %s: %v", tt.slug, err)
			}
		})
	}
}

func TestOnboardingService_ValidateRequest(t *testing.T) {
	service := &OnboardingService{baseDomain: "shop.com"}

	tests := []struct {
		name      string
		req       OnboardingRequest
		shouldErr bool
	}{
		{
			name: "valid request",
			req: OnboardingRequest{
				OwnerEmail:    "valid@email.com",
				OwnerName:     "John Doe",
				OwnerPassword: "password123",
				StoreName:     "My Store",
				StoreSlug:     "my-store",
			},
			shouldErr: false,
		},
		{
			name: "invalid email",
			req: OnboardingRequest{
				OwnerEmail:    "invalid-email",
				OwnerName:     "John Doe",
				OwnerPassword: "password123",
				StoreName:     "My Store",
				StoreSlug:     "my-store",
			},
			shouldErr: true,
		},
		{
			name: "short password",
			req: OnboardingRequest{
				OwnerEmail:    "valid@email.com",
				OwnerName:     "John Doe",
				OwnerPassword: "short",
				StoreName:     "My Store",
				StoreSlug:     "my-store",
			},
			shouldErr: true,
		},
		{
			name: "missing store name",
			req: OnboardingRequest{
				OwnerEmail:    "valid@email.com",
				OwnerName:     "John Doe",
				OwnerPassword: "password123",
				StoreName:     "",
				StoreSlug:     "my-store",
			},
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateRequest(tt.req)
			if tt.shouldErr && err == nil {
				t.Error("expected error")
			}
			if !tt.shouldErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestOnboardingService_GenerateSlug(t *testing.T) {
	service := &OnboardingService{baseDomain: "shop.com"}

	tests := []struct {
		storeName string
	}{
		{"My Store"},
		{"Магазин Електроніки"},  // Cyrillic
		{"Store with CAPS"},
		{"  Spaces Around  "},
		{"Special!@#Characters"},
	}

	for _, tt := range tests {
		t.Run(tt.storeName, func(t *testing.T) {
			slug := service.GenerateSlug(tt.storeName)

			// Should be lowercase
			for _, c := range slug {
				if c >= 'A' && c <= 'Z' {
					t.Errorf("slug should be lowercase: %s", slug)
					break
				}
			}

			// Should not start or end with hyphen
			if slug[0] == '-' || slug[len(slug)-1] == '-' {
				t.Errorf("slug should not start/end with hyphen: %s", slug)
			}

			// Should be valid
			if err := service.validateSlug(slug); err != nil {
				t.Errorf("generated slug should be valid: %s, error: %v", slug, err)
			}
		})
	}
}

func TestOnboardingService_CheckSlugAvailability(t *testing.T) {
	tenants := NewMockTenantService()
	service := &OnboardingService{
		tenants:    tenants,
		baseDomain: "shop.com",
	}

	// Add existing tenant
	tenants.tenants["taken-slug"] = &Tenant{ID: "tenant-1", Slug: "taken-slug"}

	// Available slug
	available, err := service.CheckSlugAvailability(context.Background(), "available-slug")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !available {
		t.Error("expected slug to be available")
	}

	// Taken slug
	available, err = service.CheckSlugAvailability(context.Background(), "taken-slug")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if available {
		t.Error("expected slug to be taken")
	}

	// Invalid slug
	_, err = service.CheckSlugAvailability(context.Background(), "-invalid")
	if err == nil {
		t.Error("expected error for invalid slug")
	}
}

func TestOnboardingService_AddCustomDomain(t *testing.T) {
	dns := NewMockDNSProvider()
	cert := NewMockCertificateProvider()

	service := &OnboardingService{
		dns:        dns,
		cert:       cert,
		baseDomain: "shop.com",
	}

	err := service.AddCustomDomain(context.Background(), AddCustomDomainInput{
		TenantID:     "tenant-1",
		CustomDomain: "mystore.com",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check CNAME was created
	if dns.cnames["mystore.com"] != "custom.shop.com" {
		t.Error("expected CNAME to be created")
	}
}

func TestOnboardingService_VerifyCustomDomain(t *testing.T) {
	dns := NewMockDNSProvider()

	service := &OnboardingService{
		dns:        dns,
		baseDomain: "shop.com",
	}

	// Unverified domain
	verified, instructions, err := service.VerifyCustomDomain(context.Background(), "tenant-1", "unverified.com")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if verified {
		t.Error("expected domain to not be verified")
	}
	if instructions == "" {
		t.Error("expected instructions for unverified domain")
	}

	// Verified domain
	dns.verifiedDomains["verified.com"] = true
	verified, _, err = service.VerifyCustomDomain(context.Background(), "tenant-1", "verified.com")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !verified {
		t.Error("expected domain to be verified")
	}
}

func TestGenerateAPIKey(t *testing.T) {
	key := GenerateAPIKey()

	if len(key) < 20 {
		t.Errorf("API key too short: %s", key)
	}

	if key[:10] != "shop_live_" {
		t.Errorf("API key should start with shop_live_: %s", key)
	}
}

func TestGenerateSecretKey(t *testing.T) {
	key := GenerateSecretKey()

	if len(key) < 20 {
		t.Errorf("Secret key too short: %s", key)
	}

	if key[:12] != "shop_secret_" {
		t.Errorf("Secret key should start with shop_secret_: %s", key)
	}
}

func TestOnboardingService_SlugTaken(t *testing.T) {
	tenants := NewMockTenantService()
	tenants.tenants["existing-store"] = &Tenant{ID: "tenant-1", Slug: "existing-store"}

	service := NewOnboardingService(
		NewMockDNSProvider(),
		NewMockCertificateProvider(),
		NewMockUserService(),
		tenants,
		NewMockBillingService(),
		NewMockNotificationService(),
		NewMockAnalyticsService(),
		Config{BaseDomain: "shop.com"},
	)

	req := OnboardingRequest{
		OwnerEmail:    "owner@example.com",
		OwnerName:     "John Doe",
		OwnerPassword: "password123",
		StoreName:     "Existing Store",
		StoreSlug:     "existing-store",
	}

	_, err := service.ProcessOnboarding(context.Background(), req)
	if err != ErrSlugTaken {
		t.Errorf("expected ErrSlugTaken, got %v", err)
	}
}
