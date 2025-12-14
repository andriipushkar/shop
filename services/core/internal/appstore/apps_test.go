package appstore

import (
	"context"
	"strings"
	"testing"
	"time"
)

// MockRepository for testing
type MockRepository struct {
	apps          map[string]*App
	installations map[string]*AppInstallation
	authorizations map[string]*OAuthAuthorization
	tokens        map[string]*OAuthToken
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		apps:          make(map[string]*App),
		installations: make(map[string]*AppInstallation),
		authorizations: make(map[string]*OAuthAuthorization),
		tokens:        make(map[string]*OAuthToken),
	}
}

func (m *MockRepository) CreateApp(ctx context.Context, app *App) error {
	m.apps[app.ID] = app
	return nil
}

func (m *MockRepository) GetApp(ctx context.Context, id string) (*App, error) {
	if app, ok := m.apps[id]; ok {
		return app, nil
	}
	return nil, ErrAppNotFound
}

func (m *MockRepository) GetAppByClientID(ctx context.Context, clientID string) (*App, error) {
	for _, app := range m.apps {
		if app.ClientID == clientID {
			return app, nil
		}
	}
	return nil, ErrAppNotFound
}

func (m *MockRepository) GetAppBySlug(ctx context.Context, slug string) (*App, error) {
	for _, app := range m.apps {
		if app.Slug == slug {
			return app, nil
		}
	}
	return nil, ErrAppNotFound
}

func (m *MockRepository) UpdateApp(ctx context.Context, app *App) error {
	m.apps[app.ID] = app
	return nil
}

func (m *MockRepository) DeleteApp(ctx context.Context, id string) error {
	delete(m.apps, id)
	return nil
}

func (m *MockRepository) ListApps(ctx context.Context, filter AppFilter) ([]*App, int, error) {
	var result []*App
	for _, app := range m.apps {
		if filter.Status != nil && app.Status != *filter.Status {
			continue
		}
		if filter.Category != nil && app.Category != *filter.Category {
			continue
		}
		result = append(result, app)
	}
	return result, len(result), nil
}

func (m *MockRepository) ListAppsByDeveloper(ctx context.Context, developerID string) ([]*App, error) {
	var result []*App
	for _, app := range m.apps {
		if app.DeveloperID == developerID {
			result = append(result, app)
		}
	}
	return result, nil
}

func (m *MockRepository) CreateInstallation(ctx context.Context, inst *AppInstallation) error {
	m.installations[inst.ID] = inst
	return nil
}

func (m *MockRepository) GetInstallation(ctx context.Context, id string) (*AppInstallation, error) {
	if inst, ok := m.installations[id]; ok {
		return inst, nil
	}
	return nil, ErrInstallationNotFound
}

func (m *MockRepository) GetInstallationByAppAndTenant(ctx context.Context, appID, tenantID string) (*AppInstallation, error) {
	for _, inst := range m.installations {
		if inst.AppID == appID && inst.TenantID == tenantID {
			return inst, nil
		}
	}
	return nil, ErrInstallationNotFound
}

func (m *MockRepository) UpdateInstallation(ctx context.Context, inst *AppInstallation) error {
	m.installations[inst.ID] = inst
	return nil
}

func (m *MockRepository) DeleteInstallation(ctx context.Context, id string) error {
	delete(m.installations, id)
	return nil
}

func (m *MockRepository) ListInstallationsByTenant(ctx context.Context, tenantID string) ([]*AppInstallation, error) {
	var result []*AppInstallation
	for _, inst := range m.installations {
		if inst.TenantID == tenantID {
			result = append(result, inst)
		}
	}
	return result, nil
}

func (m *MockRepository) IncrementInstallCount(ctx context.Context, appID string) error {
	if app, ok := m.apps[appID]; ok {
		app.InstallCount++
	}
	return nil
}

func (m *MockRepository) DecrementInstallCount(ctx context.Context, appID string) error {
	if app, ok := m.apps[appID]; ok {
		app.InstallCount--
	}
	return nil
}

func (m *MockRepository) SaveAuthorization(ctx context.Context, auth *OAuthAuthorization) error {
	m.authorizations[auth.Code] = auth
	return nil
}

func (m *MockRepository) GetAuthorization(ctx context.Context, code string) (*OAuthAuthorization, error) {
	if auth, ok := m.authorizations[code]; ok {
		return auth, nil
	}
	return nil, ErrAuthorizationExpired
}

func (m *MockRepository) DeleteAuthorization(ctx context.Context, code string) error {
	delete(m.authorizations, code)
	return nil
}

func (m *MockRepository) SaveToken(ctx context.Context, token *OAuthToken) error {
	m.tokens[token.ID] = token
	return nil
}

func (m *MockRepository) GetTokenByAccess(ctx context.Context, accessTokenHash string) (*OAuthToken, error) {
	for _, token := range m.tokens {
		if token.AccessToken == accessTokenHash {
			return token, nil
		}
	}
	return nil, ErrTokenExpired
}

func (m *MockRepository) GetTokenByRefresh(ctx context.Context, refreshTokenHash string) (*OAuthToken, error) {
	for _, token := range m.tokens {
		if token.RefreshToken == refreshTokenHash {
			return token, nil
		}
	}
	return nil, ErrTokenExpired
}

func (m *MockRepository) RevokeToken(ctx context.Context, id string) error {
	if token, ok := m.tokens[id]; ok {
		now := time.Now()
		token.RevokedAt = &now
	}
	return nil
}

func (m *MockRepository) RevokeAllTokens(ctx context.Context, installationID string) error {
	now := time.Now()
	for _, token := range m.tokens {
		if token.InstallationID == installationID {
			token.RevokedAt = &now
		}
	}
	return nil
}

func (m *MockRepository) CreateReview(ctx context.Context, review *AppReview) error {
	return nil
}

func (m *MockRepository) GetReview(ctx context.Context, id string) (*AppReview, error) {
	return nil, nil
}

func (m *MockRepository) ListReviews(ctx context.Context, appID string, limit, offset int) ([]*AppReview, error) {
	return nil, nil
}

func (m *MockRepository) UpdateAppRating(ctx context.Context, appID string) error {
	return nil
}

// Tests

func TestService_RegisterApp(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	app, secret, err := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Укрпошта Integration",
		Slug:         "ukrposhta",
		Description:  "Integration with Ukrposhta shipping",
		Category:     CategoryShipping,
		SupportEmail: "support@ukrposhta-app.com",
		PrivacyURL:   "https://ukrposhta-app.com/privacy",
		RedirectURIs: []string{"https://ukrposhta-app.com/oauth/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders, ScopeWriteOrders},
		IsFree:       false,
		MonthlyPrice: 9.99,
		TrialDays:    14,
	})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if app.ID == "" {
		t.Error("expected app ID to be set")
	}

	if app.ClientID == "" {
		t.Error("expected client ID to be set")
	}

	if secret == "" {
		t.Error("expected client secret to be returned")
	}

	if app.Status != AppStatusDraft {
		t.Errorf("expected status draft, got %s", app.Status)
	}

	if app.DeveloperID != "dev-123" {
		t.Errorf("expected developer dev-123, got %s", app.DeveloperID)
	}
}

func TestService_RegisterApp_InvalidScope(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	_, _, err := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test App",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{"invalid:scope"},
	})

	if err != ErrInvalidScope {
		t.Errorf("expected ErrInvalidScope, got %v", err)
	}
}

func TestService_RegisterApp_InvalidRedirectURI(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	_, _, err := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test App",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"http://insecure.com/callback"}, // Not HTTPS
		Scopes:       []OAuthScope{ScopeReadOrders},
	})

	if err != ErrInvalidRedirectURI {
		t.Errorf("expected ErrInvalidRedirectURI, got %v", err)
	}
}

func TestService_AppLifecycle(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Create app
	app, _, _ := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test App",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders},
	})

	// Submit for review
	err := service.SubmitForReview(context.Background(), app.ID)
	if err != nil {
		t.Fatalf("submit failed: %v", err)
	}

	app, _ = service.GetApp(context.Background(), app.ID)
	if app.Status != AppStatusPending {
		t.Errorf("expected pending status, got %s", app.Status)
	}

	// Approve
	err = service.ApproveApp(context.Background(), app.ID)
	if err != nil {
		t.Fatalf("approve failed: %v", err)
	}

	app, _ = service.GetApp(context.Background(), app.ID)
	if app.Status != AppStatusApproved {
		t.Errorf("expected approved status, got %s", app.Status)
	}

	// Publish
	err = service.PublishApp(context.Background(), app.ID)
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	app, _ = service.GetApp(context.Background(), app.ID)
	if app.Status != AppStatusPublished {
		t.Errorf("expected published status, got %s", app.Status)
	}
	if app.PublishedAt == nil {
		t.Error("expected published_at to be set")
	}
}

func TestService_InstallApp(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Create and publish app
	app, _, _ := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test App",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders, ScopeWriteOrders},
		TrialDays:    14,
	})
	service.SubmitForReview(context.Background(), app.ID)
	service.ApproveApp(context.Background(), app.ID)
	service.PublishApp(context.Background(), app.ID)

	// Install
	installation, err := service.InstallApp(context.Background(), app.ID, "tenant-1", "user-1", []OAuthScope{ScopeReadOrders})
	if err != nil {
		t.Fatalf("install failed: %v", err)
	}

	if installation.ID == "" {
		t.Error("expected installation ID")
	}
	if installation.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", installation.TenantID)
	}
	if len(installation.Scopes) != 1 {
		t.Errorf("expected 1 scope, got %d", len(installation.Scopes))
	}
	if installation.TrialEndsAt == nil {
		t.Error("expected trial end date for paid app")
	}

	// Verify install count
	app, _ = service.GetApp(context.Background(), app.ID)
	if app.InstallCount != 1 {
		t.Errorf("expected install count 1, got %d", app.InstallCount)
	}
}

func TestService_InstallApp_AlreadyInstalled(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	app, _, _ := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders},
		IsFree:       true,
	})
	service.SubmitForReview(context.Background(), app.ID)
	service.ApproveApp(context.Background(), app.ID)
	service.PublishApp(context.Background(), app.ID)

	// First install
	service.InstallApp(context.Background(), app.ID, "tenant-1", "user-1", []OAuthScope{ScopeReadOrders})

	// Second install
	_, err := service.InstallApp(context.Background(), app.ID, "tenant-1", "user-1", []OAuthScope{ScopeReadOrders})
	if err != ErrAppAlreadyExists {
		t.Errorf("expected ErrAppAlreadyExists, got %v", err)
	}
}

func TestService_UninstallApp(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	app, _, _ := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders},
		IsFree:       true,
	})
	service.SubmitForReview(context.Background(), app.ID)
	service.ApproveApp(context.Background(), app.ID)
	service.PublishApp(context.Background(), app.ID)

	service.InstallApp(context.Background(), app.ID, "tenant-1", "user-1", []OAuthScope{ScopeReadOrders})

	err := service.UninstallApp(context.Background(), app.ID, "tenant-1")
	if err != nil {
		t.Fatalf("uninstall failed: %v", err)
	}

	// Verify install count
	app, _ = service.GetApp(context.Background(), app.ID)
	if app.InstallCount != 0 {
		t.Errorf("expected install count 0, got %d", app.InstallCount)
	}
}

func TestService_OAuth_Authorize(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	app, _, _ := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders, ScopeWriteOrders},
	})

	code, err := service.Authorize(context.Background(), AuthorizeInput{
		ClientID:    app.ClientID,
		TenantID:    "tenant-1",
		UserID:      "user-1",
		Scopes:      []OAuthScope{ScopeReadOrders},
		RedirectURI: "https://test.com/callback",
		State:       "random-state",
	})

	if err != nil {
		t.Fatalf("authorize failed: %v", err)
	}

	if code == "" {
		t.Error("expected authorization code")
	}
}

func TestService_OAuth_InvalidRedirectURI(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	app, _, _ := service.RegisterApp(context.Background(), "dev-123", RegisterAppInput{
		Name:         "Test",
		Slug:         "test",
		Description:  "Test",
		Category:     CategoryShipping,
		SupportEmail: "test@test.com",
		PrivacyURL:   "https://test.com/privacy",
		RedirectURIs: []string{"https://test.com/callback"},
		Scopes:       []OAuthScope{ScopeReadOrders},
	})

	_, err := service.Authorize(context.Background(), AuthorizeInput{
		ClientID:    app.ClientID,
		TenantID:    "tenant-1",
		UserID:      "user-1",
		Scopes:      []OAuthScope{ScopeReadOrders},
		RedirectURI: "https://evil.com/callback", // Not registered
		State:       "state",
	})

	if err != ErrInvalidRedirectURI {
		t.Errorf("expected ErrInvalidRedirectURI, got %v", err)
	}
}

func TestOAuthScopes(t *testing.T) {
	scopes := AvailableScopes

	if len(scopes) == 0 {
		t.Error("expected available scopes")
	}

	for _, scope := range scopes {
		if scope == "" {
			t.Error("scope should not be empty")
		}
		if !isValidScope(scope) {
			t.Errorf("scope %s should be valid", scope)
		}
	}
}

func TestAppCategories(t *testing.T) {
	categories := []AppCategory{
		CategoryShipping,
		CategoryPayment,
		CategoryMarketing,
		CategoryAnalytics,
		CategoryInventory,
		CategoryCustomerService,
		CategoryAccounting,
		CategoryIntegration,
	}

	for _, cat := range categories {
		if cat == "" {
			t.Error("category should not be empty")
		}
	}
}

func TestAppStatus(t *testing.T) {
	statuses := []AppStatus{
		AppStatusDraft,
		AppStatusPending,
		AppStatusApproved,
		AppStatusRejected,
		AppStatusPublished,
		AppStatusSuspended,
	}

	for _, status := range statuses {
		if status == "" {
			t.Error("status should not be empty")
		}
	}
}

func TestIsValidRedirectURI(t *testing.T) {
	valid := []string{
		"https://example.com/callback",
		"https://app.example.com/oauth",
		"http://localhost:3000/callback",
		"http://127.0.0.1:8080/callback",
	}

	for _, uri := range valid {
		if !isValidRedirectURI(uri) {
			t.Errorf("expected %s to be valid", uri)
		}
	}

	invalid := []string{
		"http://example.com/callback", // No HTTPS
		"ftp://example.com/callback",
		"",
		"not-a-url",
	}

	for _, uri := range invalid {
		if isValidRedirectURI(uri) {
			t.Errorf("expected %s to be invalid", uri)
		}
	}
}

func TestGenerateFunctions(t *testing.T) {
	// App ID
	id1 := generateAppID()
	id2 := generateAppID()
	if id1 == id2 {
		t.Error("IDs should be unique")
	}
	if !strings.HasPrefix(id1, "app_") {
		t.Error("App ID should start with app_")
	}

	// Client ID
	cid := generateClientID()
	if len(cid) < 16 {
		t.Error("Client ID too short")
	}

	// Client Secret
	secret := generateClientSecret()
	if len(secret) < 20 {
		t.Error("Client secret too short")
	}

	// Token
	token := generateToken()
	if len(token) < 20 {
		t.Error("Token too short")
	}
}

func TestHashSecret(t *testing.T) {
	secret := "test-secret"
	hash1 := hashSecret(secret)
	hash2 := hashSecret(secret)

	if hash1 != hash2 {
		t.Error("same input should produce same hash")
	}

	hash3 := hashSecret("different-secret")
	if hash1 == hash3 {
		t.Error("different input should produce different hash")
	}

	if len(hash1) != 64 { // SHA256 hex
		t.Errorf("expected 64 char hash, got %d", len(hash1))
	}
}

func TestScopesToString(t *testing.T) {
	scopes := []OAuthScope{ScopeReadOrders, ScopeWriteOrders}
	result := scopesToString(scopes)

	if result != "read:orders write:orders" {
		t.Errorf("unexpected scope string: %s", result)
	}
}

func TestVerifyPKCE(t *testing.T) {
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

	// S256 method
	// challenge = base64url(sha256(verifier))
	if verifyPKCE("wrong-verifier", "some-challenge", "S256") {
		t.Error("PKCE should fail with wrong verifier")
	}

	// Plain method
	if !verifyPKCE(verifier, verifier, "plain") {
		t.Error("Plain PKCE should match")
	}
}
