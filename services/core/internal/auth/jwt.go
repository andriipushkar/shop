package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrExpiredToken     = errors.New("token has expired")
	ErrInvalidClaims    = errors.New("invalid claims")
	ErrMissingToken     = errors.New("missing authorization token")
	ErrInvalidSignature = errors.New("invalid token signature")
)

// Role represents user role
type Role string

const (
	RoleCustomer Role = "customer"
	RoleAdmin    Role = "admin"
	RoleManager  Role = "manager"
	RoleSupport  Role = "support"
)

// Claims represents JWT claims
type Claims struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
	Role      Role   `json:"role"`
	SessionID string `json:"session_id"`
	jwt.RegisteredClaims
}

// TokenPair represents access and refresh tokens
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	TokenType    string    `json:"token_type"`
}

// Config holds JWT configuration
type Config struct {
	SecretKey            string
	AccessTokenDuration  time.Duration
	RefreshTokenDuration time.Duration
	Issuer               string
}

// DefaultConfig returns default JWT configuration
func DefaultConfig() *Config {
	return &Config{
		SecretKey:            "",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "shop-api",
	}
}

// JWTManager handles JWT operations
type JWTManager struct {
	config *Config
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(config *Config) *JWTManager {
	if config == nil {
		config = DefaultConfig()
	}
	return &JWTManager{config: config}
}

// GenerateTokenPair generates access and refresh tokens
func (m *JWTManager) GenerateTokenPair(userID, email, phone string, role Role) (*TokenPair, error) {
	sessionID, err := generateSessionID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session ID: %w", err)
	}

	now := time.Now()
	accessExpiry := now.Add(m.config.AccessTokenDuration)
	refreshExpiry := now.Add(m.config.RefreshTokenDuration)

	// Access token claims
	accessClaims := &Claims{
		UserID:    userID,
		Email:     email,
		Phone:     phone,
		Role:      role,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    m.config.Issuer,
			Subject:   userID,
			ID:        sessionID,
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(m.config.SecretKey))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token claims
	refreshClaims := &Claims{
		UserID:    userID,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    m.config.Issuer,
			Subject:   userID,
			ID:        sessionID + "-refresh",
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(m.config.SecretKey))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresAt:    accessExpiry,
		TokenType:    "Bearer",
	}, nil
}

// ValidateToken validates a JWT token and returns claims
func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(m.config.SecretKey), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		if errors.Is(err, jwt.ErrSignatureInvalid) {
			return nil, ErrInvalidSignature
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidClaims
	}

	return claims, nil
}

// RefreshTokens refreshes tokens using a refresh token
func (m *JWTManager) RefreshTokens(refreshToken string, getUserRole func(userID string) (Role, string, string, error)) (*TokenPair, error) {
	claims, err := m.ValidateToken(refreshToken)
	if err != nil {
		return nil, err
	}

	// Get current user role and info
	role, email, phone, err := getUserRole(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	return m.GenerateTokenPair(claims.UserID, email, phone, role)
}

// ExtractTokenFromHeader extracts token from Authorization header
func ExtractTokenFromHeader(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", ErrMissingToken
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", ErrInvalidToken
	}

	return parts[1], nil
}

// generateSessionID generates a random session ID
func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// Context key for user claims
type contextKey string

const ClaimsContextKey contextKey = "claims"

// GetClaimsFromContext retrieves claims from context
func GetClaimsFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(ClaimsContextKey).(*Claims)
	return claims, ok
}

// SetClaimsToContext sets claims to context
func SetClaimsToContext(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, ClaimsContextKey, claims)
}

// Middleware creates an authentication middleware
func (m *JWTManager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := ExtractTokenFromHeader(r)
		if err != nil {
			http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
			return
		}

		claims, err := m.ValidateToken(token)
		if err != nil {
			http.Error(w, `{"error": "invalid token"}`, http.StatusUnauthorized)
			return
		}

		ctx := SetClaimsToContext(r.Context(), claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole creates a middleware that requires a specific role
func RequireRole(roles ...Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := GetClaimsFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
				return
			}

			hasRole := false
			for _, role := range roles {
				if claims.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// OptionalAuth creates a middleware that optionally authenticates
func (m *JWTManager) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := ExtractTokenFromHeader(r)
		if err == nil {
			claims, err := m.ValidateToken(token)
			if err == nil {
				ctx := SetClaimsToContext(r.Context(), claims)
				r = r.WithContext(ctx)
			}
		}
		next.ServeHTTP(w, r)
	})
}
