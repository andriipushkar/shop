package appstore

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"
)

// Errors
var (
	ErrAppNotFound          = errors.New("app not found")
	ErrAppAlreadyExists     = errors.New("app already exists")
	ErrInvalidClientSecret  = errors.New("invalid client secret")
	ErrInvalidRedirectURI   = errors.New("invalid redirect URI")
	ErrInvalidScope         = errors.New("invalid scope")
	ErrAuthorizationExpired = errors.New("authorization expired")
	ErrTokenExpired         = errors.New("token expired")
	ErrTokenRevoked         = errors.New("token revoked")
	ErrInstallationNotFound = errors.New("installation not found")
)

// AppStatus represents app status
type AppStatus string

const (
	AppStatusDraft     AppStatus = "draft"
	AppStatusPending   AppStatus = "pending"   // Pending review
	AppStatusApproved  AppStatus = "approved"
	AppStatusRejected  AppStatus = "rejected"
	AppStatusPublished AppStatus = "published"
	AppStatusSuspended AppStatus = "suspended"
)

// AppCategory represents app category
type AppCategory string

const (
	CategoryShipping     AppCategory = "shipping"
	CategoryPayment      AppCategory = "payment"
	CategoryMarketing    AppCategory = "marketing"
	CategoryAnalytics    AppCategory = "analytics"
	CategoryInventory    AppCategory = "inventory"
	CategoryCustomerService AppCategory = "customer_service"
	CategoryAccounting   AppCategory = "accounting"
	CategoryIntegration  AppCategory = "integration"
)

// OAuthScope represents available OAuth scopes
type OAuthScope string

const (
	ScopeReadProducts    OAuthScope = "read:products"
	ScopeWriteProducts   OAuthScope = "write:products"
	ScopeReadOrders      OAuthScope = "read:orders"
	ScopeWriteOrders     OAuthScope = "write:orders"
	ScopeReadCustomers   OAuthScope = "read:customers"
	ScopeWriteCustomers  OAuthScope = "write:customers"
	ScopeReadInventory   OAuthScope = "read:inventory"
	ScopeWriteInventory  OAuthScope = "write:inventory"
	ScopeReadAnalytics   OAuthScope = "read:analytics"
	ScopeWebhooks        OAuthScope = "webhooks"
	ScopeStorefront      OAuthScope = "storefront"
)

// AvailableScopes lists all available scopes
var AvailableScopes = []OAuthScope{
	ScopeReadProducts,
	ScopeWriteProducts,
	ScopeReadOrders,
	ScopeWriteOrders,
	ScopeReadCustomers,
	ScopeWriteCustomers,
	ScopeReadInventory,
	ScopeWriteInventory,
	ScopeReadAnalytics,
	ScopeWebhooks,
	ScopeStorefront,
}

// App represents a third-party application
type App struct {
	ID           string      `json:"id"`
	DeveloperID  string      `json:"developer_id"`
	Name         string      `json:"name"`
	Slug         string      `json:"slug"`
	Description  string      `json:"description"`
	LongDescription string   `json:"long_description,omitempty"`
	Category     AppCategory `json:"category"`
	Icon         string      `json:"icon"`
	Screenshots  []string    `json:"screenshots,omitempty"`
	Website      string      `json:"website,omitempty"`
	SupportEmail string      `json:"support_email"`
	PrivacyURL   string      `json:"privacy_url"`
	TermsURL     string      `json:"terms_url,omitempty"`

	// OAuth2 Configuration
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"-"` // Never expose
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []OAuthScope `json:"scopes"`

	// Webhooks the app subscribes to
	WebhookEvents []string `json:"webhook_events,omitempty"`
	WebhookURL    string   `json:"webhook_url,omitempty"`

	// Pricing
	IsFree       bool    `json:"is_free"`
	MonthlyPrice float64 `json:"monthly_price,omitempty"`
	TrialDays    int     `json:"trial_days,omitempty"`

	// Stats
	InstallCount int     `json:"install_count"`
	Rating       float64 `json:"rating"`
	ReviewCount  int     `json:"review_count"`

	// Status
	Status      AppStatus  `json:"status"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// AppInstallation represents an app installed on a tenant
type AppInstallation struct {
	ID          string       `json:"id"`
	AppID       string       `json:"app_id"`
	TenantID    string       `json:"tenant_id"`
	InstalledBy string       `json:"installed_by"` // User ID
	Scopes      []OAuthScope `json:"scopes"`       // Granted scopes
	IsActive    bool         `json:"is_active"`
	TrialEndsAt *time.Time   `json:"trial_ends_at,omitempty"`
	InstalledAt time.Time    `json:"installed_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// OAuthAuthorization represents pending authorization
type OAuthAuthorization struct {
	Code         string       `json:"code"`
	AppID        string       `json:"app_id"`
	TenantID     string       `json:"tenant_id"`
	UserID       string       `json:"user_id"`
	Scopes       []OAuthScope `json:"scopes"`
	RedirectURI  string       `json:"redirect_uri"`
	State        string       `json:"state"`
	CodeChallenge string      `json:"code_challenge,omitempty"` // PKCE
	ChallengeMethod string    `json:"challenge_method,omitempty"`
	ExpiresAt    time.Time    `json:"expires_at"`
	CreatedAt    time.Time    `json:"created_at"`
}

// OAuthToken represents an access token
type OAuthToken struct {
	ID              string       `json:"id"`
	AccessToken     string       `json:"-"` // Hashed
	RefreshToken    string       `json:"-"` // Hashed
	AppID           string       `json:"app_id"`
	TenantID        string       `json:"tenant_id"`
	InstallationID  string       `json:"installation_id"`
	Scopes          []OAuthScope `json:"scopes"`
	AccessExpiresAt time.Time    `json:"access_expires_at"`
	RefreshExpiresAt time.Time   `json:"refresh_expires_at"`
	RevokedAt       *time.Time   `json:"revoked_at,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
}

// TokenResponse is returned after successful OAuth
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

// AppReview represents a user review
type AppReview struct {
	ID        string    `json:"id"`
	AppID     string    `json:"app_id"`
	TenantID  string    `json:"tenant_id"`
	UserID    string    `json:"user_id"`
	Rating    int       `json:"rating"` // 1-5
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Repository interface
type Repository interface {
	// Apps
	CreateApp(ctx context.Context, app *App) error
	GetApp(ctx context.Context, id string) (*App, error)
	GetAppByClientID(ctx context.Context, clientID string) (*App, error)
	GetAppBySlug(ctx context.Context, slug string) (*App, error)
	UpdateApp(ctx context.Context, app *App) error
	DeleteApp(ctx context.Context, id string) error
	ListApps(ctx context.Context, filter AppFilter) ([]*App, int, error)
	ListAppsByDeveloper(ctx context.Context, developerID string) ([]*App, error)

	// Installations
	CreateInstallation(ctx context.Context, installation *AppInstallation) error
	GetInstallation(ctx context.Context, id string) (*AppInstallation, error)
	GetInstallationByAppAndTenant(ctx context.Context, appID, tenantID string) (*AppInstallation, error)
	UpdateInstallation(ctx context.Context, installation *AppInstallation) error
	DeleteInstallation(ctx context.Context, id string) error
	ListInstallationsByTenant(ctx context.Context, tenantID string) ([]*AppInstallation, error)
	IncrementInstallCount(ctx context.Context, appID string) error
	DecrementInstallCount(ctx context.Context, appID string) error

	// OAuth
	SaveAuthorization(ctx context.Context, auth *OAuthAuthorization) error
	GetAuthorization(ctx context.Context, code string) (*OAuthAuthorization, error)
	DeleteAuthorization(ctx context.Context, code string) error
	SaveToken(ctx context.Context, token *OAuthToken) error
	GetTokenByAccess(ctx context.Context, accessTokenHash string) (*OAuthToken, error)
	GetTokenByRefresh(ctx context.Context, refreshTokenHash string) (*OAuthToken, error)
	RevokeToken(ctx context.Context, id string) error
	RevokeAllTokens(ctx context.Context, installationID string) error

	// Reviews
	CreateReview(ctx context.Context, review *AppReview) error
	GetReview(ctx context.Context, id string) (*AppReview, error)
	ListReviews(ctx context.Context, appID string, limit, offset int) ([]*AppReview, error)
	UpdateAppRating(ctx context.Context, appID string) error
}

// AppFilter for listing apps
type AppFilter struct {
	Category  *AppCategory
	Status    *AppStatus
	IsFree    *bool
	Search    string
	SortBy    string // name, rating, installs, created_at
	SortOrder string // asc, desc
	Page      int
	PageSize  int
}

// Service handles app store operations
type Service struct {
	repo Repository
}

// NewService creates a new app store service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ==================== App Management ====================

// RegisterApp registers a new app for a developer
func (s *Service) RegisterApp(ctx context.Context, developerID string, input RegisterAppInput) (*App, string, error) {
	// Validate scopes
	for _, scope := range input.Scopes {
		if !isValidScope(scope) {
			return nil, "", ErrInvalidScope
		}
	}

	// Validate redirect URIs
	for _, uri := range input.RedirectURIs {
		if !isValidRedirectURI(uri) {
			return nil, "", ErrInvalidRedirectURI
		}
	}

	clientSecret := generateClientSecret()

	app := &App{
		ID:           generateAppID(),
		DeveloperID:  developerID,
		Name:         input.Name,
		Slug:         input.Slug,
		Description:  input.Description,
		Category:     input.Category,
		SupportEmail: input.SupportEmail,
		PrivacyURL:   input.PrivacyURL,
		ClientID:     generateClientID(),
		ClientSecret: hashSecret(clientSecret),
		RedirectURIs: input.RedirectURIs,
		Scopes:       input.Scopes,
		IsFree:       input.IsFree,
		MonthlyPrice: input.MonthlyPrice,
		TrialDays:    input.TrialDays,
		Status:       AppStatusDraft,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.CreateApp(ctx, app); err != nil {
		return nil, "", err
	}

	return app, clientSecret, nil // Return plain secret only once
}

// RegisterAppInput for creating an app
type RegisterAppInput struct {
	Name         string
	Slug         string
	Description  string
	Category     AppCategory
	SupportEmail string
	PrivacyURL   string
	RedirectURIs []string
	Scopes       []OAuthScope
	IsFree       bool
	MonthlyPrice float64
	TrialDays    int
}

// GetApp retrieves an app
func (s *Service) GetApp(ctx context.Context, id string) (*App, error) {
	return s.repo.GetApp(ctx, id)
}

// ListApps lists apps in the store
func (s *Service) ListApps(ctx context.Context, filter AppFilter) ([]*App, int, error) {
	// Only show published apps to regular users
	if filter.Status == nil {
		status := AppStatusPublished
		filter.Status = &status
	}

	if filter.PageSize == 0 {
		filter.PageSize = 20
	}

	return s.repo.ListApps(ctx, filter)
}

// SubmitForReview submits app for review
func (s *Service) SubmitForReview(ctx context.Context, appID string) error {
	app, err := s.repo.GetApp(ctx, appID)
	if err != nil {
		return err
	}

	if app.Status != AppStatusDraft && app.Status != AppStatusRejected {
		return errors.New("app cannot be submitted for review")
	}

	app.Status = AppStatusPending
	app.UpdatedAt = time.Now()

	return s.repo.UpdateApp(ctx, app)
}

// ApproveApp approves an app (admin only)
func (s *Service) ApproveApp(ctx context.Context, appID string) error {
	app, err := s.repo.GetApp(ctx, appID)
	if err != nil {
		return err
	}

	app.Status = AppStatusApproved
	app.UpdatedAt = time.Now()

	return s.repo.UpdateApp(ctx, app)
}

// PublishApp publishes an approved app
func (s *Service) PublishApp(ctx context.Context, appID string) error {
	app, err := s.repo.GetApp(ctx, appID)
	if err != nil {
		return err
	}

	if app.Status != AppStatusApproved {
		return errors.New("app must be approved before publishing")
	}

	now := time.Now()
	app.Status = AppStatusPublished
	app.PublishedAt = &now
	app.UpdatedAt = now

	return s.repo.UpdateApp(ctx, app)
}

// ==================== Installation ====================

// InstallApp installs an app for a tenant
func (s *Service) InstallApp(ctx context.Context, appID, tenantID, userID string, grantedScopes []OAuthScope) (*AppInstallation, error) {
	app, err := s.repo.GetApp(ctx, appID)
	if err != nil {
		return nil, err
	}

	if app.Status != AppStatusPublished {
		return nil, errors.New("app is not available")
	}

	// Validate scopes are subset of app's scopes
	for _, scope := range grantedScopes {
		found := false
		for _, appScope := range app.Scopes {
			if scope == appScope {
				found = true
				break
			}
		}
		if !found {
			return nil, ErrInvalidScope
		}
	}

	// Check if already installed
	existing, _ := s.repo.GetInstallationByAppAndTenant(ctx, appID, tenantID)
	if existing != nil {
		return nil, ErrAppAlreadyExists
	}

	installation := &AppInstallation{
		ID:          generateInstallationID(),
		AppID:       appID,
		TenantID:    tenantID,
		InstalledBy: userID,
		Scopes:      grantedScopes,
		IsActive:    true,
		InstalledAt: time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Set trial end date if applicable
	if app.TrialDays > 0 && !app.IsFree {
		trialEnd := time.Now().AddDate(0, 0, app.TrialDays)
		installation.TrialEndsAt = &trialEnd
	}

	if err := s.repo.CreateInstallation(ctx, installation); err != nil {
		return nil, err
	}

	// Increment install count
	s.repo.IncrementInstallCount(ctx, appID)

	return installation, nil
}

// UninstallApp removes an app from a tenant
func (s *Service) UninstallApp(ctx context.Context, appID, tenantID string) error {
	installation, err := s.repo.GetInstallationByAppAndTenant(ctx, appID, tenantID)
	if err != nil {
		return err
	}

	// Revoke all tokens
	s.repo.RevokeAllTokens(ctx, installation.ID)

	// Delete installation
	if err := s.repo.DeleteInstallation(ctx, installation.ID); err != nil {
		return err
	}

	// Decrement install count
	s.repo.DecrementInstallCount(ctx, appID)

	return nil
}

// ListInstalledApps lists apps installed for a tenant
func (s *Service) ListInstalledApps(ctx context.Context, tenantID string) ([]*AppInstallation, error) {
	return s.repo.ListInstallationsByTenant(ctx, tenantID)
}

// ==================== OAuth2 ====================

// Authorize creates an authorization code
func (s *Service) Authorize(ctx context.Context, input AuthorizeInput) (string, error) {
	app, err := s.repo.GetAppByClientID(ctx, input.ClientID)
	if err != nil {
		return "", ErrAppNotFound
	}

	// Validate redirect URI
	validURI := false
	for _, uri := range app.RedirectURIs {
		if uri == input.RedirectURI {
			validURI = true
			break
		}
	}
	if !validURI {
		return "", ErrInvalidRedirectURI
	}

	// Validate scopes
	for _, scope := range input.Scopes {
		found := false
		for _, appScope := range app.Scopes {
			if scope == appScope {
				found = true
				break
			}
		}
		if !found {
			return "", ErrInvalidScope
		}
	}

	code := generateAuthCode()

	auth := &OAuthAuthorization{
		Code:           code,
		AppID:          app.ID,
		TenantID:       input.TenantID,
		UserID:         input.UserID,
		Scopes:         input.Scopes,
		RedirectURI:    input.RedirectURI,
		State:          input.State,
		CodeChallenge:  input.CodeChallenge,
		ChallengeMethod: input.ChallengeMethod,
		ExpiresAt:      time.Now().Add(10 * time.Minute),
		CreatedAt:      time.Now(),
	}

	if err := s.repo.SaveAuthorization(ctx, auth); err != nil {
		return "", err
	}

	return code, nil
}

// AuthorizeInput for OAuth authorization
type AuthorizeInput struct {
	ClientID        string
	TenantID        string
	UserID          string
	Scopes          []OAuthScope
	RedirectURI     string
	State           string
	CodeChallenge   string
	ChallengeMethod string
}

// ExchangeCode exchanges authorization code for tokens
func (s *Service) ExchangeCode(ctx context.Context, input ExchangeCodeInput) (*TokenResponse, error) {
	auth, err := s.repo.GetAuthorization(ctx, input.Code)
	if err != nil {
		return nil, ErrAuthorizationExpired
	}

	// Check expiration
	if time.Now().After(auth.ExpiresAt) {
		s.repo.DeleteAuthorization(ctx, input.Code)
		return nil, ErrAuthorizationExpired
	}

	// Verify client
	app, err := s.repo.GetAppByClientID(ctx, input.ClientID)
	if err != nil {
		return nil, ErrAppNotFound
	}

	if app.ID != auth.AppID {
		return nil, ErrInvalidClientSecret
	}

	// Verify client secret
	if hashSecret(input.ClientSecret) != app.ClientSecret {
		return nil, ErrInvalidClientSecret
	}

	// Verify redirect URI
	if auth.RedirectURI != input.RedirectURI {
		return nil, ErrInvalidRedirectURI
	}

	// Verify PKCE if used
	if auth.CodeChallenge != "" {
		if !verifyPKCE(input.CodeVerifier, auth.CodeChallenge, auth.ChallengeMethod) {
			return nil, errors.New("invalid code verifier")
		}
	}

	// Get or create installation
	installation, err := s.repo.GetInstallationByAppAndTenant(ctx, app.ID, auth.TenantID)
	if err != nil {
		// Auto-install on first OAuth
		installation = &AppInstallation{
			ID:          generateInstallationID(),
			AppID:       app.ID,
			TenantID:    auth.TenantID,
			InstalledBy: auth.UserID,
			Scopes:      auth.Scopes,
			IsActive:    true,
			InstalledAt: time.Now(),
			UpdatedAt:   time.Now(),
		}
		s.repo.CreateInstallation(ctx, installation)
		s.repo.IncrementInstallCount(ctx, app.ID)
	}

	// Generate tokens
	accessToken := generateToken()
	refreshToken := generateToken()

	token := &OAuthToken{
		ID:               generateTokenID(),
		AccessToken:      hashSecret(accessToken),
		RefreshToken:     hashSecret(refreshToken),
		AppID:            app.ID,
		TenantID:         auth.TenantID,
		InstallationID:   installation.ID,
		Scopes:           auth.Scopes,
		AccessExpiresAt:  time.Now().Add(1 * time.Hour),
		RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:        time.Now(),
	}

	if err := s.repo.SaveToken(ctx, token); err != nil {
		return nil, err
	}

	// Delete authorization code
	s.repo.DeleteAuthorization(ctx, input.Code)

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		Scope:        scopesToString(auth.Scopes),
	}, nil
}

// ExchangeCodeInput for token exchange
type ExchangeCodeInput struct {
	Code         string
	ClientID     string
	ClientSecret string
	RedirectURI  string
	CodeVerifier string
}

// RefreshToken refreshes an access token
func (s *Service) RefreshToken(ctx context.Context, refreshToken, clientID, clientSecret string) (*TokenResponse, error) {
	tokenHash := hashSecret(refreshToken)
	token, err := s.repo.GetTokenByRefresh(ctx, tokenHash)
	if err != nil {
		return nil, ErrTokenExpired
	}

	if token.RevokedAt != nil {
		return nil, ErrTokenRevoked
	}

	if time.Now().After(token.RefreshExpiresAt) {
		return nil, ErrTokenExpired
	}

	// Verify client
	app, err := s.repo.GetAppByClientID(ctx, clientID)
	if err != nil {
		return nil, ErrAppNotFound
	}

	if hashSecret(clientSecret) != app.ClientSecret {
		return nil, ErrInvalidClientSecret
	}

	// Revoke old token
	s.repo.RevokeToken(ctx, token.ID)

	// Generate new tokens
	newAccessToken := generateToken()
	newRefreshToken := generateToken()

	newToken := &OAuthToken{
		ID:               generateTokenID(),
		AccessToken:      hashSecret(newAccessToken),
		RefreshToken:     hashSecret(newRefreshToken),
		AppID:            app.ID,
		TenantID:         token.TenantID,
		InstallationID:   token.InstallationID,
		Scopes:           token.Scopes,
		AccessExpiresAt:  time.Now().Add(1 * time.Hour),
		RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:        time.Now(),
	}

	if err := s.repo.SaveToken(ctx, newToken); err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		Scope:        scopesToString(token.Scopes),
	}, nil
}

// ValidateToken validates an access token
func (s *Service) ValidateToken(ctx context.Context, accessToken string) (*OAuthToken, error) {
	tokenHash := hashSecret(accessToken)
	token, err := s.repo.GetTokenByAccess(ctx, tokenHash)
	if err != nil {
		return nil, ErrTokenExpired
	}

	if token.RevokedAt != nil {
		return nil, ErrTokenRevoked
	}

	if time.Now().After(token.AccessExpiresAt) {
		return nil, ErrTokenExpired
	}

	return token, nil
}

// RevokeToken revokes an access token
func (s *Service) RevokeToken(ctx context.Context, tokenID string) error {
	return s.repo.RevokeToken(ctx, tokenID)
}

// ==================== Helper Functions ====================

func generateAppID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "app_" + hex.EncodeToString(b)
}

func generateClientID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateClientSecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func generateInstallationID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "inst_" + hex.EncodeToString(b)
}

func generateAuthCode() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func generateTokenID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "tok_" + hex.EncodeToString(b)
}

func hashSecret(secret string) string {
	h := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(h[:])
}

func isValidScope(scope OAuthScope) bool {
	for _, s := range AvailableScopes {
		if s == scope {
			return true
		}
	}
	return false
}

func isValidRedirectURI(uri string) bool {
	// Must be HTTPS (except localhost for development)
	if len(uri) < 8 {
		return false
	}
	if uri[:8] == "https://" {
		return true
	}
	// Allow localhost and 127.0.0.1 for development
	if len(uri) >= 17 && uri[:17] == "http://localhost:" {
		return true
	}
	if len(uri) >= 17 && uri[:17] == "http://127.0.0.1:" {
		return true
	}
	return false
}

func scopesToString(scopes []OAuthScope) string {
	result := ""
	for i, s := range scopes {
		if i > 0 {
			result += " "
		}
		result += string(s)
	}
	return result
}

func verifyPKCE(verifier, challenge, method string) bool {
	if method == "S256" {
		h := sha256.Sum256([]byte(verifier))
		expected := base64.RawURLEncoding.EncodeToString(h[:])
		return expected == challenge
	}
	// Plain method
	return verifier == challenge
}
