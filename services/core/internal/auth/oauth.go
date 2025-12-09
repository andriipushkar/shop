package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrOAuthStateMismatch = errors.New("OAuth state mismatch")
	ErrOAuthCodeExchange  = errors.New("failed to exchange OAuth code")
	ErrOAuthUserInfo      = errors.New("failed to get user info")
)

// OAuthProvider represents an OAuth provider
type OAuthProvider string

const (
	ProviderGoogle   OAuthProvider = "google"
	ProviderFacebook OAuthProvider = "facebook"
)

// OAuthConfig holds OAuth provider configuration
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
}

// OAuthUser represents user info from OAuth provider
type OAuthUser struct {
	Provider  OAuthProvider `json:"provider"`
	ID        string        `json:"id"`
	Email     string        `json:"email"`
	Name      string        `json:"name"`
	FirstName string        `json:"first_name"`
	LastName  string        `json:"last_name"`
	AvatarURL string        `json:"avatar_url"`
	Verified  bool          `json:"verified"`
}

// GoogleOAuth handles Google OAuth
type GoogleOAuth struct {
	config *OAuthConfig
	client *http.Client
}

// NewGoogleOAuth creates a new Google OAuth handler
func NewGoogleOAuth(config *OAuthConfig) *GoogleOAuth {
	if config.Scopes == nil {
		config.Scopes = []string{"email", "profile"}
	}
	return &GoogleOAuth{
		config: config,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetAuthURL returns the Google OAuth URL
func (g *GoogleOAuth) GetAuthURL(state string) string {
	params := url.Values{
		"client_id":     {g.config.ClientID},
		"redirect_uri":  {g.config.RedirectURL},
		"response_type": {"code"},
		"scope":         {strings.Join(g.config.Scopes, " ")},
		"state":         {state},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
	}
	return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()
}

// ExchangeCode exchanges the authorization code for tokens
func (g *GoogleOAuth) ExchangeCode(ctx context.Context, code string) (*OAuthTokens, error) {
	data := url.Values{
		"client_id":     {g.config.ClientID},
		"client_secret": {g.config.ClientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {g.config.RedirectURL},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrOAuthCodeExchange, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: status %d, body: %s", ErrOAuthCodeExchange, resp.StatusCode, string(body))
	}

	var tokens OAuthTokens
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

// GetUserInfo gets user info from Google
func (g *GoogleOAuth) GetUserInfo(ctx context.Context, accessToken string) (*OAuthUser, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrOAuthUserInfo, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrOAuthUserInfo, resp.StatusCode)
	}

	var googleUser struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		VerifiedEmail bool   `json:"verified_email"`
		Name          string `json:"name"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Picture       string `json:"picture"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		return nil, err
	}

	return &OAuthUser{
		Provider:  ProviderGoogle,
		ID:        googleUser.ID,
		Email:     googleUser.Email,
		Name:      googleUser.Name,
		FirstName: googleUser.GivenName,
		LastName:  googleUser.FamilyName,
		AvatarURL: googleUser.Picture,
		Verified:  googleUser.VerifiedEmail,
	}, nil
}

// FacebookOAuth handles Facebook OAuth
type FacebookOAuth struct {
	config *OAuthConfig
	client *http.Client
}

// NewFacebookOAuth creates a new Facebook OAuth handler
func NewFacebookOAuth(config *OAuthConfig) *FacebookOAuth {
	if config.Scopes == nil {
		config.Scopes = []string{"email", "public_profile"}
	}
	return &FacebookOAuth{
		config: config,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetAuthURL returns the Facebook OAuth URL
func (f *FacebookOAuth) GetAuthURL(state string) string {
	params := url.Values{
		"client_id":     {f.config.ClientID},
		"redirect_uri":  {f.config.RedirectURL},
		"response_type": {"code"},
		"scope":         {strings.Join(f.config.Scopes, ",")},
		"state":         {state},
	}
	return "https://www.facebook.com/v18.0/dialog/oauth?" + params.Encode()
}

// ExchangeCode exchanges the authorization code for tokens
func (f *FacebookOAuth) ExchangeCode(ctx context.Context, code string) (*OAuthTokens, error) {
	params := url.Values{
		"client_id":     {f.config.ClientID},
		"client_secret": {f.config.ClientSecret},
		"code":          {code},
		"redirect_uri":  {f.config.RedirectURL},
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://graph.facebook.com/v18.0/oauth/access_token?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrOAuthCodeExchange, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: status %d, body: %s", ErrOAuthCodeExchange, resp.StatusCode, string(body))
	}

	var tokens OAuthTokens
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

// GetUserInfo gets user info from Facebook
func (f *FacebookOAuth) GetUserInfo(ctx context.Context, accessToken string) (*OAuthUser, error) {
	params := url.Values{
		"fields":       {"id,email,name,first_name,last_name,picture.type(large)"},
		"access_token": {accessToken},
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://graph.facebook.com/v18.0/me?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrOAuthUserInfo, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrOAuthUserInfo, resp.StatusCode)
	}

	var fbUser struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Picture   struct {
			Data struct {
				URL string `json:"url"`
			} `json:"data"`
		} `json:"picture"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&fbUser); err != nil {
		return nil, err
	}

	return &OAuthUser{
		Provider:  ProviderFacebook,
		ID:        fbUser.ID,
		Email:     fbUser.Email,
		Name:      fbUser.Name,
		FirstName: fbUser.FirstName,
		LastName:  fbUser.LastName,
		AvatarURL: fbUser.Picture.Data.URL,
		Verified:  fbUser.Email != "",
	}, nil
}

// OAuthTokens represents OAuth tokens
type OAuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
}

// OAuthManager manages multiple OAuth providers
type OAuthManager struct {
	providers map[OAuthProvider]OAuthProviderInterface
}

// OAuthProviderInterface defines OAuth provider methods
type OAuthProviderInterface interface {
	GetAuthURL(state string) string
	ExchangeCode(ctx context.Context, code string) (*OAuthTokens, error)
	GetUserInfo(ctx context.Context, accessToken string) (*OAuthUser, error)
}

// NewOAuthManager creates a new OAuth manager
func NewOAuthManager() *OAuthManager {
	return &OAuthManager{
		providers: make(map[OAuthProvider]OAuthProviderInterface),
	}
}

// RegisterProvider registers an OAuth provider
func (m *OAuthManager) RegisterProvider(name OAuthProvider, provider OAuthProviderInterface) {
	m.providers[name] = provider
}

// GetProvider gets an OAuth provider
func (m *OAuthManager) GetProvider(name OAuthProvider) (OAuthProviderInterface, bool) {
	provider, ok := m.providers[name]
	return provider, ok
}

// GetAuthURL returns the OAuth URL for a provider
func (m *OAuthManager) GetAuthURL(provider OAuthProvider, state string) (string, error) {
	p, ok := m.providers[provider]
	if !ok {
		return "", fmt.Errorf("unknown provider: %s", provider)
	}
	return p.GetAuthURL(state), nil
}

// HandleCallback handles OAuth callback
func (m *OAuthManager) HandleCallback(ctx context.Context, provider OAuthProvider, code string) (*OAuthUser, error) {
	p, ok := m.providers[provider]
	if !ok {
		return nil, fmt.Errorf("unknown provider: %s", provider)
	}

	tokens, err := p.ExchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}

	return p.GetUserInfo(ctx, tokens.AccessToken)
}
