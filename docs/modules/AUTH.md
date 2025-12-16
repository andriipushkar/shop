# Authentication & Authorization Module

Модуль автентифікації та авторизації Shop Platform.

## Огляд

Модуль Auth забезпечує:
- Реєстрацію та вхід користувачів
- JWT токени (access + refresh)
- OAuth2 провайдери (Google, Facebook, Apple)
- Двофакторну автентифікацію (2FA)
- Управління ролями та правами
- API ключі для інтеграцій

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Login Request ──► Validate ──► Generate Tokens ──► Response   │
│        │               │               │                         │
│        ▼               ▼               ▼                         │
│   ┌─────────┐    ┌──────────┐    ┌───────────┐                  │
│   │ Email/  │    │ Password │    │   JWT     │                  │
│   │ OAuth   │    │ Verify   │    │ Access +  │                  │
│   │         │    │ 2FA      │    │ Refresh   │                  │
│   └─────────┘    └──────────┘    └───────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Authorization Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Request ──► Extract Token ──► Verify ──► Check Permissions    │
│                    │              │               │              │
│                    ▼              ▼               ▼              │
│              ┌──────────┐  ┌───────────┐  ┌─────────────┐       │
│              │  Bearer  │  │   JWT     │  │   RBAC      │       │
│              │  Token   │  │  Validate │  │  Check      │       │
│              └──────────┘  └───────────┘  └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Моделі даних

```go
// internal/auth/models.go
package auth

import (
	"time"
)

type User struct {
	ID              string     `gorm:"primaryKey" json:"id"`
	TenantID        string     `gorm:"index" json:"tenant_id"`
	Email           string     `gorm:"index" json:"email"`
	PasswordHash    string     `json:"-"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	Phone           string     `json:"phone,omitempty"`
	Avatar          string     `json:"avatar,omitempty"`

	// Status
	Status          UserStatus `json:"status"`
	Role            string     `json:"role"` // customer, admin, owner

	// Verification
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	PhoneVerifiedAt *time.Time `json:"phone_verified_at,omitempty"`

	// 2FA
	TwoFactorEnabled bool      `json:"two_factor_enabled"`
	TwoFactorSecret  string    `json:"-"`

	// OAuth
	OAuthProvider   string     `json:"oauth_provider,omitempty"`
	OAuthID         string     `json:"oauth_id,omitempty"`

	// Security
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP     string     `json:"last_login_ip,omitempty"`
	FailedAttempts  int        `json:"-"`
	LockedUntil     *time.Time `json:"-"`

	// Metadata
	Metadata        map[string]any `gorm:"serializer:json" json:"metadata,omitempty"`

	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusInactive  UserStatus = "inactive"
	UserStatusPending   UserStatus = "pending"
	UserStatusSuspended UserStatus = "suspended"
)

type Session struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	UserID       string    `gorm:"index" json:"user_id"`
	TenantID     string    `gorm:"index" json:"tenant_id"`
	RefreshToken string    `gorm:"index" json:"-"`
	UserAgent    string    `json:"user_agent"`
	IPAddress    string    `json:"ip_address"`
	ExpiresAt    time.Time `json:"expires_at"`
	CreatedAt    time.Time `json:"created_at"`
	LastUsedAt   time.Time `json:"last_used_at"`
}

type APIKey struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	TenantID    string     `gorm:"index" json:"tenant_id"`
	UserID      string     `json:"user_id"`
	Name        string     `json:"name"`
	KeyHash     string     `json:"-"` // Hashed key
	KeyPrefix   string     `json:"key_prefix"` // First 8 chars for identification
	Scopes      []string   `gorm:"serializer:json" json:"scopes"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
}

type Role struct {
	ID          string       `gorm:"primaryKey" json:"id"`
	TenantID    string       `gorm:"index" json:"tenant_id"`
	Name        string       `json:"name"`
	Code        string       `gorm:"index" json:"code"`
	Description string       `json:"description,omitempty"`
	Permissions []Permission `gorm:"many2many:role_permissions" json:"permissions"`
	IsSystem    bool         `json:"is_system"` // Cannot be deleted
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type Permission struct {
	ID          string `gorm:"primaryKey" json:"id"`
	Resource    string `json:"resource"` // products, orders, users
	Action      string `json:"action"`   // create, read, update, delete, manage
	Description string `json:"description,omitempty"`
}

type PasswordReset struct {
	ID        string    `gorm:"primaryKey"`
	UserID    string    `gorm:"index"`
	Token     string    `gorm:"index"`
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}
```

## Auth Service

```go
// internal/auth/service.go
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db           *gorm.DB
	cache        CacheService
	jwtSecret    []byte
	jwtExpiry    time.Duration
	refreshExpiry time.Duration
	notifier     NotificationService
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	TokenType    string    `json:"token_type"`
}

type Claims struct {
	jwt.RegisteredClaims
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// Register creates a new user account
func (s *AuthService) Register(ctx context.Context, tenantID string, req RegisterRequest) (*User, error) {
	// Check if email exists
	var count int64
	s.db.Model(&User{}).Where("tenant_id = ? AND email = ?", tenantID, req.Email).Count(&count)
	if count > 0 {
		return nil, fmt.Errorf("email already registered")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Phone:        req.Phone,
		Status:       UserStatusPending,
		Role:         "customer",
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}

	// Send verification email
	go s.sendVerificationEmail(ctx, user)

	return user, nil
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(ctx context.Context, tenantID string, req LoginRequest) (*TokenPair, *User, error) {
	var user User
	if err := s.db.Where("tenant_id = ? AND email = ?", tenantID, req.Email).First(&user).Error; err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	// Check if locked
	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		return nil, nil, fmt.Errorf("account locked, try again later")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// Increment failed attempts
		s.incrementFailedAttempts(ctx, &user)
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	// Check 2FA
	if user.TwoFactorEnabled {
		if req.TOTPCode == "" {
			return nil, nil, fmt.Errorf("2fa_required")
		}
		if !totp.Validate(req.TOTPCode, user.TwoFactorSecret) {
			return nil, nil, fmt.Errorf("invalid 2FA code")
		}
	}

	// Check status
	if user.Status != UserStatusActive {
		return nil, nil, fmt.Errorf("account is not active")
	}

	// Reset failed attempts
	s.db.Model(&user).Updates(map[string]interface{}{
		"failed_attempts": 0,
		"locked_until":    nil,
		"last_login_at":   time.Now(),
		"last_login_ip":   req.IPAddress,
	})

	// Generate tokens
	tokens, err := s.generateTokens(ctx, &user, req.UserAgent, req.IPAddress)
	if err != nil {
		return nil, nil, err
	}

	return tokens, &user, nil
}

// Logout invalidates the session
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.db.Where("refresh_token = ?", refreshToken).Delete(&Session{}).Error
}

// RefreshTokens refreshes the access token
func (s *AuthService) RefreshTokens(ctx context.Context, refreshToken string) (*TokenPair, error) {
	var session Session
	if err := s.db.Where("refresh_token = ? AND expires_at > ?", refreshToken, time.Now()).First(&session).Error; err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	var user User
	if err := s.db.First(&user, "id = ?", session.UserID).Error; err != nil {
		return nil, err
	}

	// Delete old session
	s.db.Delete(&session)

	// Generate new tokens
	return s.generateTokens(ctx, &user, session.UserAgent, session.IPAddress)
}

// VerifyToken verifies and parses a JWT token
func (s *AuthService) VerifyToken(ctx context.Context, tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// ForgotPassword sends a password reset email
func (s *AuthService) ForgotPassword(ctx context.Context, tenantID, email string) error {
	var user User
	if err := s.db.Where("tenant_id = ? AND email = ?", tenantID, email).First(&user).Error; err != nil {
		// Don't reveal if email exists
		return nil
	}

	// Generate reset token
	token := generateSecureToken(32)

	reset := &PasswordReset{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	if err := s.db.Create(reset).Error; err != nil {
		return err
	}

	// Send email
	go s.notifier.SendPasswordResetEmail(ctx, user.Email, token)

	return nil
}

// ResetPassword resets the password with token
func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
	var reset PasswordReset
	if err := s.db.Where("token = ? AND expires_at > ? AND used_at IS NULL", token, time.Now()).First(&reset).Error; err != nil {
		return fmt.Errorf("invalid or expired token")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx := s.db.Begin()

	// Update password
	if err := tx.Model(&User{}).Where("id = ?", reset.UserID).Update("password_hash", string(hashedPassword)).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Mark token as used
	now := time.Now()
	if err := tx.Model(&reset).Update("used_at", &now).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Invalidate all sessions
	tx.Where("user_id = ?", reset.UserID).Delete(&Session{})

	return tx.Commit().Error
}

// Enable2FA enables two-factor authentication
func (s *AuthService) Enable2FA(ctx context.Context, userID string) (*TwoFactorSetup, error) {
	var user User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}

	// Generate secret
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Shop Platform",
		AccountName: user.Email,
	})
	if err != nil {
		return nil, err
	}

	// Store secret temporarily (confirm with code before enabling)
	s.cache.Set(ctx, fmt.Sprintf("2fa_setup:%s", userID), key.Secret(), 10*time.Minute)

	return &TwoFactorSetup{
		Secret: key.Secret(),
		QRCode: key.URL(),
	}, nil
}

// Confirm2FA confirms and enables 2FA
func (s *AuthService) Confirm2FA(ctx context.Context, userID, code string) error {
	// Get secret from cache
	var secret string
	if err := s.cache.Get(ctx, fmt.Sprintf("2fa_setup:%s", userID), &secret); err != nil {
		return fmt.Errorf("2FA setup expired")
	}

	// Validate code
	if !totp.Validate(code, secret) {
		return fmt.Errorf("invalid code")
	}

	// Enable 2FA
	if err := s.db.Model(&User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"two_factor_enabled": true,
		"two_factor_secret":  secret,
	}).Error; err != nil {
		return err
	}

	// Delete from cache
	s.cache.Delete(ctx, fmt.Sprintf("2fa_setup:%s", userID))

	return nil
}

// OAuthLogin handles OAuth authentication
func (s *AuthService) OAuthLogin(ctx context.Context, tenantID string, provider string, oauthUser OAuthUser, ipAddress, userAgent string) (*TokenPair, *User, error) {
	var user User

	// Try to find by OAuth ID
	err := s.db.Where("tenant_id = ? AND oauth_provider = ? AND oauth_id = ?", tenantID, provider, oauthUser.ID).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// Try to find by email
		err = s.db.Where("tenant_id = ? AND email = ?", tenantID, oauthUser.Email).First(&user).Error

		if err == gorm.ErrRecordNotFound {
			// Create new user
			user = User{
				ID:              uuid.New().String(),
				TenantID:        tenantID,
				Email:           oauthUser.Email,
				FirstName:       oauthUser.FirstName,
				LastName:        oauthUser.LastName,
				Avatar:          oauthUser.Avatar,
				OAuthProvider:   provider,
				OAuthID:         oauthUser.ID,
				Status:          UserStatusActive,
				Role:            "customer",
				EmailVerifiedAt: timePtr(time.Now()),
			}

			if err := s.db.Create(&user).Error; err != nil {
				return nil, nil, err
			}
		} else if err != nil {
			return nil, nil, err
		} else {
			// Link OAuth to existing user
			s.db.Model(&user).Updates(map[string]interface{}{
				"oauth_provider":    provider,
				"oauth_id":          oauthUser.ID,
				"email_verified_at": time.Now(),
			})
		}
	} else if err != nil {
		return nil, nil, err
	}

	// Generate tokens
	tokens, err := s.generateTokens(ctx, &user, userAgent, ipAddress)
	if err != nil {
		return nil, nil, err
	}

	return tokens, &user, nil
}

func (s *AuthService) generateTokens(ctx context.Context, user *User, userAgent, ipAddress string) (*TokenPair, error) {
	// Generate access token
	expiresAt := time.Now().Add(s.jwtExpiry)

	claims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
		UserID:   user.ID,
		TenantID: user.TenantID,
		Email:    user.Email,
		Role:     user.Role,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, err
	}

	// Generate refresh token
	refreshToken := generateSecureToken(64)

	// Store session
	session := &Session{
		ID:           uuid.New().String(),
		UserID:       user.ID,
		TenantID:     user.TenantID,
		RefreshToken: refreshToken,
		UserAgent:    userAgent,
		IPAddress:    ipAddress,
		ExpiresAt:    time.Now().Add(s.refreshExpiry),
		LastUsedAt:   time.Now(),
	}

	if err := s.db.Create(session).Error; err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) incrementFailedAttempts(ctx context.Context, user *User) {
	user.FailedAttempts++

	updates := map[string]interface{}{
		"failed_attempts": user.FailedAttempts,
	}

	// Lock account after 5 failed attempts
	if user.FailedAttempts >= 5 {
		lockUntil := time.Now().Add(30 * time.Minute)
		updates["locked_until"] = &lockUntil
	}

	s.db.Model(user).Updates(updates)
}

func generateSecureToken(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func timePtr(t time.Time) *time.Time {
	return &t
}
```

## Authorization Middleware

```go
// internal/auth/middleware.go
package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(authService *AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
			return
		}

		claims, err := authService.VerifyToken(c.Request.Context(), parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// Set user info in context
		c.Set("user_id", claims.UserID)
		c.Set("tenant_id", claims.TenantID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)

		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := c.GetString("role")

		for _, role := range roles {
			if userRole == role {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func RequirePermission(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		tenantID := c.GetString("tenant_id")

		// Check permission (implementation depends on your RBAC system)
		if !hasPermission(tenantID, userID, resource, action) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}

		c.Next()
	}
}
```

## API Endpoints

```go
// POST /api/v1/auth/register - Register new user
// POST /api/v1/auth/login - Login
// POST /api/v1/auth/logout - Logout
// POST /api/v1/auth/refresh - Refresh tokens
// POST /api/v1/auth/forgot-password - Request password reset
// POST /api/v1/auth/reset-password - Reset password
// POST /api/v1/auth/verify-email - Verify email
// POST /api/v1/auth/2fa/enable - Enable 2FA
// POST /api/v1/auth/2fa/confirm - Confirm 2FA
// POST /api/v1/auth/2fa/disable - Disable 2FA
// GET /api/v1/auth/sessions - List active sessions
// DELETE /api/v1/auth/sessions/:id - Revoke session
// GET /api/v1/auth/oauth/:provider - Start OAuth flow
// GET /api/v1/auth/oauth/:provider/callback - OAuth callback
```

## Frontend Integration

```typescript
// src/lib/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password, totpCode) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login({ email, password, totp_code: totpCode });
          set({
            user: response.user,
            accessToken: response.tokens.access_token,
            refreshToken: response.tokens.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          await authApi.register(data);
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          await authApi.logout(refreshToken);
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await authApi.refresh(refreshToken);
        set({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
        });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Axios interceptor for auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await useAuth.getState().refreshTokens();
        const { accessToken } = useAuth.getState();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        useAuth.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

## Див. також

- [Security](./SECURITY.md)
- [API Authentication](../api/AUTHENTICATION.md)
- [GDPR](../compliance/GDPR.md)
