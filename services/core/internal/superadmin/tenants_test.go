package superadmin

import (
	"context"
	"strings"
	"testing"
	"time"
)

// MockRepository for testing
type MockRepository struct {
	tenants map[string]*Tenant
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		tenants: make(map[string]*Tenant),
	}
}

func (m *MockRepository) Create(ctx context.Context, tenant *Tenant) error {
	m.tenants[tenant.ID] = tenant
	return nil
}

func (m *MockRepository) GetByID(ctx context.Context, id string) (*Tenant, error) {
	if tenant, ok := m.tenants[id]; ok {
		return tenant, nil
	}
	return nil, ErrTenantNotFound
}

func (m *MockRepository) GetByDomain(ctx context.Context, domain string) (*Tenant, error) {
	for _, tenant := range m.tenants {
		if tenant.Domain == domain {
			return tenant, nil
		}
	}
	return nil, ErrTenantNotFound
}

func (m *MockRepository) List(ctx context.Context, filter TenantFilter) ([]*Tenant, int, error) {
	var result []*Tenant
	for _, tenant := range m.tenants {
		if filter.Status != nil && tenant.Status != *filter.Status {
			continue
		}
		if filter.Plan != nil && tenant.Plan != *filter.Plan {
			continue
		}
		if filter.Search != "" && !strings.Contains(strings.ToLower(tenant.Name), strings.ToLower(filter.Search)) {
			continue
		}
		result = append(result, tenant)
	}
	return result, len(result), nil
}

func (m *MockRepository) Update(ctx context.Context, tenant *Tenant) error {
	m.tenants[tenant.ID] = tenant
	return nil
}

func (m *MockRepository) Delete(ctx context.Context, id string) error {
	delete(m.tenants, id)
	return nil
}

func (m *MockRepository) UpdateUsage(ctx context.Context, id string, usage TenantUsage) error {
	if tenant, ok := m.tenants[id]; ok {
		tenant.Usage = usage
	}
	return nil
}

// MockProvisioner for testing
type MockProvisioner struct {
	shouldFail     bool
	failStep       string
	createdSchemas []string
	createdDNS     []string
}

func NewMockProvisioner() *MockProvisioner {
	return &MockProvisioner{
		createdSchemas: []string{},
		createdDNS:     []string{},
	}
}

func (m *MockProvisioner) CreateDatabaseSchema(ctx context.Context, schemaName string) error {
	if m.shouldFail && m.failStep == "database" {
		return ErrProvisioningFailed
	}
	m.createdSchemas = append(m.createdSchemas, schemaName)
	return nil
}

func (m *MockProvisioner) CreateDNSRecord(ctx context.Context, domain string) error {
	if m.shouldFail && m.failStep == "dns" {
		return ErrProvisioningFailed
	}
	m.createdDNS = append(m.createdDNS, domain)
	return nil
}

func (m *MockProvisioner) ProvisionSSLCertificate(ctx context.Context, domain string) (string, error) {
	if m.shouldFail && m.failStep == "ssl" {
		return "", ErrProvisioningFailed
	}
	return "cert_" + domain, nil
}

func (m *MockProvisioner) CreateAPIKey(ctx context.Context, tenantID string) (string, string, error) {
	if m.shouldFail && m.failStep == "apikey" {
		return "", "", ErrProvisioningFailed
	}
	return "shop_live_test123", "shop_secret_test456", nil
}

func (m *MockProvisioner) CleanupProvisioning(ctx context.Context, tenant *Tenant) error {
	return nil
}

func TestService_CreateTenant(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	result, err := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanPro,
		OwnerEmail: "owner@test.com",
		OwnerName:  "Test Owner",
	})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result.TenantID == "" {
		t.Error("expected tenant ID to be set")
	}

	if result.Domain != "teststore" {
		t.Errorf("expected domain teststore, got %s", result.Domain)
	}

	if result.APIKey == "" {
		t.Error("expected API key to be set")
	}

	if result.SecretKey == "" {
		t.Error("expected secret key to be set")
	}

	// Verify tenant was created in repo
	tenant, err := repo.GetByID(context.Background(), result.TenantID)
	if err != nil {
		t.Fatalf("expected tenant to be stored, got %v", err)
	}

	if tenant.Status != StatusActive {
		t.Errorf("expected status active, got %s", tenant.Status)
	}
}

func TestService_CreateTenant_DuplicateDomain(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create first tenant
	_, err := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "First Store",
		Domain:     "mystore",
		Plan:       PlanStarter,
		OwnerEmail: "first@test.com",
		OwnerName:  "First Owner",
	})
	if err != nil {
		t.Fatalf("first create should succeed: %v", err)
	}

	// Try to create second tenant with same domain
	_, err = service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Second Store",
		Domain:     "mystore",
		Plan:       PlanStarter,
		OwnerEmail: "second@test.com",
		OwnerName:  "Second Owner",
	})

	if err != ErrTenantAlreadyExists {
		t.Errorf("expected ErrTenantAlreadyExists, got %v", err)
	}
}

func TestService_CreateTenant_InvalidDomain(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	tests := []struct {
		name   string
		domain string
	}{
		{"too short", "ab"},
		{"starts with hyphen", "-test"},
		{"ends with hyphen", "test-"},
		{"contains invalid chars", "test@store"},
		{"too long", strings.Repeat("a", 51)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.CreateTenant(context.Background(), CreateTenantInput{
				Name:       "Test",
				Domain:     tt.domain,
				Plan:       PlanStarter,
				OwnerEmail: "test@test.com",
				OwnerName:  "Test",
			})

			if err != ErrInvalidDomain {
				t.Errorf("expected ErrInvalidDomain for domain %s, got %v", tt.domain, err)
			}
		})
	}
}

func TestService_CreateTenant_InvalidPlan(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	_, err := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       SubscriptionPlan("invalid"),
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	if err != ErrInvalidPlan {
		t.Errorf("expected ErrInvalidPlan, got %v", err)
	}
}

func TestService_CreateTenant_ProvisioningFailure(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	provisioner.shouldFail = true
	provisioner.failStep = "dns"
	service := NewService(repo, provisioner)

	_, err := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	if err != ErrProvisioningFailed {
		t.Errorf("expected ErrProvisioningFailed, got %v", err)
	}
}

func TestService_GetTenant(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create a tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanPro,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Get tenant
	tenant, err := service.GetTenant(context.Background(), result.TenantID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tenant.Name != "Test Store" {
		t.Errorf("expected name 'Test Store', got %s", tenant.Name)
	}
}

func TestService_GetTenant_NotFound(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	_, err := service.GetTenant(context.Background(), "nonexistent")
	if err != ErrTenantNotFound {
		t.Errorf("expected ErrTenantNotFound, got %v", err)
	}
}

func TestService_ListTenants(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create multiple tenants
	plans := []SubscriptionPlan{PlanStarter, PlanPro, PlanEnterprise}
	for i, plan := range plans {
		service.CreateTenant(context.Background(), CreateTenantInput{
			Name:       "Store " + string(rune('A'+i)),
			Domain:     "store" + string(rune('a'+i)),
			Plan:       plan,
			OwnerEmail: "test@test.com",
			OwnerName:  "Test",
		})
	}

	// List all
	tenants, total, err := service.ListTenants(context.Background(), TenantFilter{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if total != 3 {
		t.Errorf("expected 3 tenants, got %d", total)
	}

	// Filter by plan
	proPlan := PlanPro
	tenants, total, _ = service.ListTenants(context.Background(), TenantFilter{Plan: &proPlan})
	if total != 1 {
		t.Errorf("expected 1 pro tenant, got %d", total)
	}
	if tenants[0].Plan != PlanPro {
		t.Error("expected pro plan")
	}
}

func TestService_UpdateTenant(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Original Name",
		Domain:     "teststore",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Update
	newName := "Updated Name"
	newPlan := PlanPro
	updated, err := service.UpdateTenant(context.Background(), result.TenantID, UpdateTenantInput{
		Name: &newName,
		Plan: &newPlan,
	})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if updated.Name != "Updated Name" {
		t.Errorf("expected name 'Updated Name', got %s", updated.Name)
	}

	if updated.Plan != PlanPro {
		t.Errorf("expected plan pro, got %s", updated.Plan)
	}
}

func TestService_SuspendTenant(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Suspend
	err := service.SuspendTenant(context.Background(), result.TenantID, "Payment overdue")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify status
	tenant, _ := service.GetTenant(context.Background(), result.TenantID)
	if tenant.Status != StatusSuspended {
		t.Errorf("expected status suspended, got %s", tenant.Status)
	}
	if tenant.SuspendReason != "Payment overdue" {
		t.Errorf("expected reason 'Payment overdue', got %s", tenant.SuspendReason)
	}
	if tenant.SuspendedAt == nil {
		t.Error("expected suspended_at to be set")
	}
}

func TestService_ReactivateTenant(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create and suspend tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})
	service.SuspendTenant(context.Background(), result.TenantID, "Test")

	// Reactivate
	err := service.ReactivateTenant(context.Background(), result.TenantID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify status
	tenant, _ := service.GetTenant(context.Background(), result.TenantID)
	if tenant.Status != StatusActive {
		t.Errorf("expected status active, got %s", tenant.Status)
	}
	if tenant.SuspendedAt != nil {
		t.Error("expected suspended_at to be nil")
	}
}

func TestService_DeleteTenant(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Delete (soft delete)
	err := service.DeleteTenant(context.Background(), result.TenantID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify status
	tenant, _ := service.GetTenant(context.Background(), result.TenantID)
	if tenant.Status != StatusDeleted {
		t.Errorf("expected status deleted, got %s", tenant.Status)
	}
}

func TestService_CheckLimit(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create starter tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Test Store",
		Domain:     "teststore",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Update usage to be at limit
	tenant, _ := repo.GetByID(context.Background(), result.TenantID)
	tenant.Usage.ProductCount = 99
	repo.Update(context.Background(), tenant)

	// Check limit - should be under
	allowed, err := service.CheckLimit(context.Background(), result.TenantID, "products")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !allowed {
		t.Error("expected to be under limit")
	}

	// Update to at limit
	tenant.Usage.ProductCount = 100
	repo.Update(context.Background(), tenant)

	// Check limit - should be at limit
	allowed, _ = service.CheckLimit(context.Background(), result.TenantID, "products")
	if allowed {
		t.Error("expected to be at limit")
	}
}

func TestService_CheckLimit_Enterprise_Unlimited(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create enterprise tenant
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Enterprise Store",
		Domain:     "enterprise",
		Plan:       PlanEnterprise,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Set high usage
	tenant, _ := repo.GetByID(context.Background(), result.TenantID)
	tenant.Usage.ProductCount = 1000000
	repo.Update(context.Background(), tenant)

	// Should still be allowed (unlimited)
	allowed, _ := service.CheckLimit(context.Background(), result.TenantID, "products")
	if !allowed {
		t.Error("enterprise should have unlimited products")
	}
}

func TestService_HasFeature(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	tests := []struct {
		name    string
		domain  string
		plan    SubscriptionPlan
		feature string
		want    bool
	}{
		{"starter basic", "starterbasic", PlanStarter, "basic_analytics", true},
		{"starter no visual search", "starternvs", PlanStarter, "visual_search", false},
		{"pro visual search", "provisual", PlanPro, "visual_search", true},
		{"pro no fraud detection", "pronofraud", PlanPro, "fraud_detection", false},
		{"enterprise fraud detection", "entfraud", PlanEnterprise, "fraud_detection", true},
		{"enterprise unlimited", "entunlimited", PlanEnterprise, "anything", true}, // unlimited feature
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.CreateTenant(context.Background(), CreateTenantInput{
				Name:       "Test",
				Domain:     tt.domain,
				Plan:       tt.plan,
				OwnerEmail: "test@test.com",
				OwnerName:  "Test",
			})
			if err != nil {
				t.Fatalf("failed to create tenant: %v", err)
			}

			has, _ := service.HasFeature(context.Background(), result.TenantID, tt.feature)
			if has != tt.want {
				t.Errorf("HasFeature(%s, %s) = %v, want %v", tt.plan, tt.feature, has, tt.want)
			}
		})
	}
}

func TestService_GetStats(t *testing.T) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	// Create multiple tenants
	service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Starter 1",
		Domain:     "starter1",
		Plan:       PlanStarter,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})
	service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Pro 1",
		Domain:     "pro1",
		Plan:       PlanPro,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})
	result, _ := service.CreateTenant(context.Background(), CreateTenantInput{
		Name:       "Enterprise 1",
		Domain:     "enterprise1",
		Plan:       PlanEnterprise,
		OwnerEmail: "test@test.com",
		OwnerName:  "Test",
	})

	// Suspend one
	service.SuspendTenant(context.Background(), result.TenantID, "Test")

	// Get stats
	stats, err := service.GetStats(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if stats.TotalTenants != 3 {
		t.Errorf("expected 3 total tenants, got %d", stats.TotalTenants)
	}
	if stats.ActiveTenants != 2 {
		t.Errorf("expected 2 active tenants, got %d", stats.ActiveTenants)
	}
	if stats.SuspendedTenants != 1 {
		t.Errorf("expected 1 suspended tenant, got %d", stats.SuspendedTenants)
	}
	if stats.StarterPlans != 1 {
		t.Errorf("expected 1 starter plan, got %d", stats.StarterPlans)
	}
}

func TestPlanLimits(t *testing.T) {
	// Verify plan limits are defined correctly
	starter := PlanLimits[PlanStarter]
	if starter.MaxProducts != 100 {
		t.Errorf("starter should have 100 products limit, got %d", starter.MaxProducts)
	}

	pro := PlanLimits[PlanPro]
	if pro.MaxProducts != 10000 {
		t.Errorf("pro should have 10000 products limit, got %d", pro.MaxProducts)
	}

	enterprise := PlanLimits[PlanEnterprise]
	if enterprise.MaxProducts != -1 {
		t.Errorf("enterprise should have unlimited products, got %d", enterprise.MaxProducts)
	}
}

func TestIsValidDomain(t *testing.T) {
	valid := []string{
		"abc",
		"my-store",
		"store123",
		"test-store-123",
	}

	for _, domain := range valid {
		if !isValidDomain(domain) {
			t.Errorf("expected %s to be valid", domain)
		}
	}

	invalid := []string{
		"ab",               // too short
		"-test",            // starts with hyphen
		"test-",            // ends with hyphen
		"test@store",       // invalid char
		strings.Repeat("a", 51), // too long
	}

	for _, domain := range invalid {
		if isValidDomain(domain) {
			t.Errorf("expected %s to be invalid", domain)
		}
	}
}

func TestIsValidPlan(t *testing.T) {
	valid := []SubscriptionPlan{PlanStarter, PlanPro, PlanEnterprise}
	for _, plan := range valid {
		if !isValidPlan(plan) {
			t.Errorf("expected %s to be valid", plan)
		}
	}

	if isValidPlan(SubscriptionPlan("invalid")) {
		t.Error("expected 'invalid' plan to be invalid")
	}
}

func TestGenerateTenantID(t *testing.T) {
	id1 := generateTenantID()
	id2 := generateTenantID()

	if id1 == id2 {
		t.Error("generated IDs should be unique")
	}

	if !strings.HasPrefix(id1, "ten_") {
		t.Errorf("ID should start with 'ten_', got %s", id1)
	}
}

func TestGenerateSchemaName(t *testing.T) {
	tests := []struct {
		domain string
		want   string
	}{
		{"mystore", "tenant_mystore"},
		{"my-store", "tenant_my_store"},
		{"my.store", "tenant_my_store"},
	}

	for _, tt := range tests {
		got := generateSchemaName(tt.domain)
		if got != tt.want {
			t.Errorf("generateSchemaName(%s) = %s, want %s", tt.domain, got, tt.want)
		}
	}
}

func TestDefaultSettings(t *testing.T) {
	// Test with nil input
	settings := defaultSettings(nil)
	if settings.Currency != "UAH" {
		t.Errorf("expected default currency UAH, got %s", settings.Currency)
	}
	if settings.Timezone != "Europe/Kiev" {
		t.Errorf("expected default timezone Europe/Kiev, got %s", settings.Timezone)
	}

	// Test with partial input
	input := &TenantSettings{
		Currency: "USD",
	}
	settings = defaultSettings(input)
	if settings.Currency != "USD" {
		t.Errorf("expected currency USD, got %s", settings.Currency)
	}
	if settings.Timezone != "Europe/Kiev" {
		t.Errorf("expected default timezone Europe/Kiev, got %s", settings.Timezone)
	}
}

func TestTenantStatus_Constants(t *testing.T) {
	statuses := []TenantStatus{
		StatusPending,
		StatusProvisioning,
		StatusActive,
		StatusSuspended,
		StatusDeleted,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("status should not be empty")
		}
	}
}

func TestTenantUsage_Struct(t *testing.T) {
	usage := TenantUsage{
		ProductCount:  100,
		OrderCount:    500,
		UserCount:     5,
		StorageUsed:   1024 * 1024 * 100,
		APICallsToday: 1000,
		APICallsMonth: 30000,
	}

	if usage.ProductCount != 100 {
		t.Errorf("expected 100 products, got %d", usage.ProductCount)
	}
}

func TestProvisioningResult_URLs(t *testing.T) {
	result := &ProvisioningResult{
		TenantID:      "ten_123",
		Domain:        "mystore",
		AdminURL:      "https://admin.mystore.shop.com",
		StorefrontURL: "https://mystore.shop.com",
	}

	if !strings.Contains(result.AdminURL, "admin") {
		t.Error("admin URL should contain 'admin'")
	}
	if !strings.Contains(result.StorefrontURL, result.Domain) {
		t.Error("storefront URL should contain domain")
	}
}

func TestTenantSettings_Struct(t *testing.T) {
	settings := TenantSettings{
		Currency:        "UAH",
		Timezone:        "Europe/Kiev",
		Language:        "uk",
		Logo:            "https://example.com/logo.png",
		PrimaryColor:    "#3B82F6",
		EnabledFeatures: []string{"visual_search", "cdp"},
	}

	if len(settings.EnabledFeatures) != 2 {
		t.Errorf("expected 2 enabled features, got %d", len(settings.EnabledFeatures))
	}
}

func BenchmarkCreateTenant(b *testing.B) {
	repo := NewMockRepository()
	provisioner := NewMockProvisioner()
	service := NewService(repo, provisioner)

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.CreateTenant(ctx, CreateTenantInput{
			Name:       "Benchmark Store",
			Domain:     "benchmark" + time.Now().Format("20060102150405.000000000"),
			Plan:       PlanStarter,
			OwnerEmail: "bench@test.com",
			OwnerName:  "Benchmark",
		})
	}
}
