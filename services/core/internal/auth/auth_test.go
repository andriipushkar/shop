package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// ============================================================================
// JWT Tests
// ============================================================================

func TestNewJWTManager(t *testing.T) {
	t.Run("with nil config uses defaults", func(t *testing.T) {
		manager := NewJWTManager(nil)
		if manager == nil {
			t.Fatal("expected manager to be created")
		}
		if manager.config == nil {
			t.Fatal("expected config to be set")
		}
	})

	t.Run("with custom config", func(t *testing.T) {
		config := &Config{
			SecretKey:            "test-secret",
			AccessTokenDuration:  30 * time.Minute,
			RefreshTokenDuration: 24 * time.Hour,
			Issuer:               "test-issuer",
		}
		manager := NewJWTManager(config)
		if manager.config.SecretKey != "test-secret" {
			t.Errorf("expected secret key 'test-secret', got '%s'", manager.config.SecretKey)
		}
		if manager.config.Issuer != "test-issuer" {
			t.Errorf("expected issuer 'test-issuer', got '%s'", manager.config.Issuer)
		}
	})
}

func TestGenerateTokenPair(t *testing.T) {
	config := &Config{
		SecretKey:            "test-secret-key-for-jwt-testing",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "test-issuer",
	}
	manager := NewJWTManager(config)

	tests := []struct {
		name    string
		userID  string
		email   string
		phone   string
		role    Role
		wantErr bool
	}{
		{
			name:    "valid customer token",
			userID:  "user-123",
			email:   "user@example.com",
			phone:   "+380501234567",
			role:    RoleCustomer,
			wantErr: false,
		},
		{
			name:    "valid admin token",
			userID:  "admin-456",
			email:   "admin@example.com",
			phone:   "",
			role:    RoleAdmin,
			wantErr: false,
		},
		{
			name:    "valid manager token",
			userID:  "manager-789",
			email:   "manager@example.com",
			phone:   "+380671234567",
			role:    RoleManager,
			wantErr: false,
		},
		{
			name:    "valid support token",
			userID:  "support-101",
			email:   "support@example.com",
			phone:   "",
			role:    RoleSupport,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokenPair, err := manager.GenerateTokenPair(tt.userID, tt.email, tt.phone, tt.role)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateTokenPair() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}

			if tokenPair.AccessToken == "" {
				t.Error("expected access token to be non-empty")
			}
			if tokenPair.RefreshToken == "" {
				t.Error("expected refresh token to be non-empty")
			}
			if tokenPair.TokenType != "Bearer" {
				t.Errorf("expected token type 'Bearer', got '%s'", tokenPair.TokenType)
			}
			if tokenPair.ExpiresAt.Before(time.Now()) {
				t.Error("expected expiry to be in the future")
			}
		})
	}
}

func TestValidateToken(t *testing.T) {
	config := &Config{
		SecretKey:            "test-secret-key-for-jwt-testing",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "test-issuer",
	}
	manager := NewJWTManager(config)

	t.Run("valid token", func(t *testing.T) {
		tokenPair, err := manager.GenerateTokenPair("user-123", "test@example.com", "+380501234567", RoleCustomer)
		if err != nil {
			t.Fatalf("failed to generate token: %v", err)
		}

		claims, err := manager.ValidateToken(tokenPair.AccessToken)
		if err != nil {
			t.Fatalf("failed to validate token: %v", err)
		}

		if claims.UserID != "user-123" {
			t.Errorf("expected user ID 'user-123', got '%s'", claims.UserID)
		}
		if claims.Email != "test@example.com" {
			t.Errorf("expected email 'test@example.com', got '%s'", claims.Email)
		}
		if claims.Phone != "+380501234567" {
			t.Errorf("expected phone '+380501234567', got '%s'", claims.Phone)
		}
		if claims.Role != RoleCustomer {
			t.Errorf("expected role 'customer', got '%s'", claims.Role)
		}
	})

	t.Run("invalid token", func(t *testing.T) {
		_, err := manager.ValidateToken("invalid-token")
		if err == nil {
			t.Error("expected error for invalid token")
		}
		if err != ErrInvalidToken {
			t.Errorf("expected ErrInvalidToken, got %v", err)
		}
	})

	t.Run("token with wrong secret", func(t *testing.T) {
		otherManager := NewJWTManager(&Config{
			SecretKey:           "different-secret-key",
			AccessTokenDuration: 15 * time.Minute,
			Issuer:              "test-issuer",
		})
		tokenPair, _ := otherManager.GenerateTokenPair("user-123", "test@example.com", "", RoleCustomer)

		_, err := manager.ValidateToken(tokenPair.AccessToken)
		if err == nil {
			t.Error("expected error for token signed with different secret")
		}
	})

	t.Run("expired token", func(t *testing.T) {
		expiredConfig := &Config{
			SecretKey:           "test-secret-key-for-jwt-testing",
			AccessTokenDuration: -1 * time.Hour, // Already expired
			Issuer:              "test-issuer",
		}
		expiredManager := NewJWTManager(expiredConfig)
		tokenPair, _ := expiredManager.GenerateTokenPair("user-123", "test@example.com", "", RoleCustomer)

		_, err := manager.ValidateToken(tokenPair.AccessToken)
		if err != ErrExpiredToken {
			t.Errorf("expected ErrExpiredToken, got %v", err)
		}
	})
}

func TestRefreshTokens(t *testing.T) {
	config := &Config{
		SecretKey:            "test-secret-key-for-jwt-testing",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "test-issuer",
	}
	manager := NewJWTManager(config)

	getUserRole := func(userID string) (Role, string, string, error) {
		return RoleAdmin, "admin@example.com", "+380501234567", nil
	}

	t.Run("valid refresh", func(t *testing.T) {
		tokenPair, err := manager.GenerateTokenPair("user-123", "test@example.com", "+380501234567", RoleCustomer)
		if err != nil {
			t.Fatalf("failed to generate token: %v", err)
		}

		newTokenPair, err := manager.RefreshTokens(tokenPair.RefreshToken, getUserRole)
		if err != nil {
			t.Fatalf("failed to refresh tokens: %v", err)
		}

		if newTokenPair.AccessToken == "" {
			t.Error("expected new access token")
		}
		if newTokenPair.AccessToken == tokenPair.AccessToken {
			t.Error("expected new access token to be different")
		}
	})

	t.Run("invalid refresh token", func(t *testing.T) {
		_, err := manager.RefreshTokens("invalid-refresh-token", getUserRole)
		if err == nil {
			t.Error("expected error for invalid refresh token")
		}
	})
}

func TestExtractTokenFromHeader(t *testing.T) {
	tests := []struct {
		name       string
		authHeader string
		wantToken  string
		wantErr    error
	}{
		{
			name:       "valid bearer token",
			authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantToken:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantErr:    nil,
		},
		{
			name:       "lowercase bearer",
			authHeader: "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantToken:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantErr:    nil,
		},
		{
			name:       "missing header",
			authHeader: "",
			wantToken:  "",
			wantErr:    ErrMissingToken,
		},
		{
			name:       "wrong scheme",
			authHeader: "Basic dXNlcjpwYXNz",
			wantToken:  "",
			wantErr:    ErrInvalidToken,
		},
		{
			name:       "no token after bearer",
			authHeader: "Bearer",
			wantToken:  "",
			wantErr:    ErrInvalidToken,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			token, err := ExtractTokenFromHeader(req)
			if err != tt.wantErr {
				t.Errorf("ExtractTokenFromHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if token != tt.wantToken {
				t.Errorf("ExtractTokenFromHeader() = %v, want %v", token, tt.wantToken)
			}
		})
	}
}

func TestClaimsContext(t *testing.T) {
	t.Run("set and get claims", func(t *testing.T) {
		claims := &Claims{
			UserID: "user-123",
			Email:  "test@example.com",
			Role:   RoleCustomer,
		}

		ctx := context.Background()
		ctx = SetClaimsToContext(ctx, claims)

		gotClaims, ok := GetClaimsFromContext(ctx)
		if !ok {
			t.Fatal("expected claims to be found in context")
		}
		if gotClaims.UserID != "user-123" {
			t.Errorf("expected user ID 'user-123', got '%s'", gotClaims.UserID)
		}
	})

	t.Run("missing claims", func(t *testing.T) {
		ctx := context.Background()
		_, ok := GetClaimsFromContext(ctx)
		if ok {
			t.Error("expected claims to not be found in context")
		}
	})
}

func TestJWTMiddleware(t *testing.T) {
	config := &Config{
		SecretKey:            "test-secret-key-for-jwt-testing",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "test-issuer",
	}
	manager := NewJWTManager(config)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "no claims", http.StatusInternalServerError)
			return
		}
		w.Write([]byte(claims.UserID))
	})

	t.Run("valid token", func(t *testing.T) {
		tokenPair, _ := manager.GenerateTokenPair("user-123", "test@example.com", "", RoleCustomer)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		rr := httptest.NewRecorder()

		manager.Middleware(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rr.Code)
		}
		if rr.Body.String() != "user-123" {
			t.Errorf("expected body 'user-123', got '%s'", rr.Body.String())
		}
	})

	t.Run("missing token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()

		manager.Middleware(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rr.Code)
		}
	})

	t.Run("invalid token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")
		rr := httptest.NewRecorder()

		manager.Middleware(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rr.Code)
		}
	})
}

func TestRequireRole(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name           string
		userRole       Role
		requiredRoles  []Role
		expectedStatus int
	}{
		{
			name:           "admin accessing admin route",
			userRole:       RoleAdmin,
			requiredRoles:  []Role{RoleAdmin},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "customer accessing admin route",
			userRole:       RoleCustomer,
			requiredRoles:  []Role{RoleAdmin},
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "manager accessing admin or manager route",
			userRole:       RoleManager,
			requiredRoles:  []Role{RoleAdmin, RoleManager},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "support accessing admin or manager route",
			userRole:       RoleSupport,
			requiredRoles:  []Role{RoleAdmin, RoleManager},
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims := &Claims{
				UserID: "user-123",
				Role:   tt.userRole,
			}

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			ctx := SetClaimsToContext(req.Context(), claims)
			req = req.WithContext(ctx)
			rr := httptest.NewRecorder()

			RequireRole(tt.requiredRoles...)(handler).ServeHTTP(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rr.Code)
			}
		})
	}

	t.Run("no claims in context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()

		RequireRole(RoleAdmin)(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rr.Code)
		}
	})
}

func TestOptionalAuth(t *testing.T) {
	config := &Config{
		SecretKey:            "test-secret-key-for-jwt-testing",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "test-issuer",
	}
	manager := NewJWTManager(config)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaimsFromContext(r.Context())
		if ok {
			w.Write([]byte(claims.UserID))
		} else {
			w.Write([]byte("anonymous"))
		}
	})

	t.Run("with valid token", func(t *testing.T) {
		tokenPair, _ := manager.GenerateTokenPair("user-123", "test@example.com", "", RoleCustomer)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		rr := httptest.NewRecorder()

		manager.OptionalAuth(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rr.Code)
		}
		if rr.Body.String() != "user-123" {
			t.Errorf("expected body 'user-123', got '%s'", rr.Body.String())
		}
	})

	t.Run("without token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()

		manager.OptionalAuth(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rr.Code)
		}
		if rr.Body.String() != "anonymous" {
			t.Errorf("expected body 'anonymous', got '%s'", rr.Body.String())
		}
	})

	t.Run("with invalid token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")
		rr := httptest.NewRecorder()

		manager.OptionalAuth(handler).ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rr.Code)
		}
		if rr.Body.String() != "anonymous" {
			t.Errorf("expected body 'anonymous', got '%s'", rr.Body.String())
		}
	})
}

// ============================================================================
// Password Tests
// ============================================================================

func TestNewPasswordHasher(t *testing.T) {
	t.Run("with nil params uses defaults", func(t *testing.T) {
		hasher := NewPasswordHasher(nil)
		if hasher == nil {
			t.Fatal("expected hasher to be created")
		}
		if hasher.params == nil {
			t.Fatal("expected params to be set")
		}
		defaults := DefaultArgon2Params()
		if hasher.params.Memory != defaults.Memory {
			t.Errorf("expected memory %d, got %d", defaults.Memory, hasher.params.Memory)
		}
	})

	t.Run("with custom params", func(t *testing.T) {
		params := &Argon2Params{
			Memory:      32 * 1024,
			Iterations:  4,
			Parallelism: 4,
			SaltLength:  32,
			KeyLength:   64,
		}
		hasher := NewPasswordHasher(params)
		if hasher.params.Memory != 32*1024 {
			t.Errorf("expected memory %d, got %d", 32*1024, hasher.params.Memory)
		}
	})
}

func TestPasswordHash(t *testing.T) {
	hasher := NewPasswordHasher(nil)

	tests := []struct {
		name     string
		password string
		wantErr  error
	}{
		{
			name:     "valid password",
			password: "SecurePass123!",
			wantErr:  nil,
		},
		{
			name:     "password at min length",
			password: "12345678",
			wantErr:  nil,
		},
		{
			name:     "password too short",
			password: "1234567",
			wantErr:  ErrPasswordTooShort,
		},
		{
			name:     "password at max length",
			password: strings.Repeat("a", 72),
			wantErr:  nil,
		},
		{
			name:     "password too long",
			password: strings.Repeat("a", 73),
			wantErr:  ErrPasswordTooLong,
		},
		{
			name:     "unicode password",
			password: "Пароль123!",
			wantErr:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash, err := hasher.Hash(tt.password)
			if err != tt.wantErr {
				t.Errorf("Hash() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr != nil {
				return
			}

			if !strings.HasPrefix(hash, "$argon2id$") {
				t.Errorf("expected hash to start with '$argon2id$', got '%s'", hash[:20])
			}
		})
	}
}

func TestPasswordVerify(t *testing.T) {
	hasher := NewPasswordHasher(nil)

	t.Run("correct password", func(t *testing.T) {
		password := "SecurePass123!"
		hash, err := hasher.Hash(password)
		if err != nil {
			t.Fatalf("failed to hash: %v", err)
		}

		err = hasher.Verify(password, hash)
		if err != nil {
			t.Errorf("Verify() error = %v", err)
		}
	})

	t.Run("wrong password", func(t *testing.T) {
		password := "SecurePass123!"
		hash, err := hasher.Hash(password)
		if err != nil {
			t.Fatalf("failed to hash: %v", err)
		}

		err = hasher.Verify("WrongPassword!", hash)
		if err != ErrPasswordMismatch {
			t.Errorf("expected ErrPasswordMismatch, got %v", err)
		}
	})

	t.Run("invalid hash format", func(t *testing.T) {
		err := hasher.Verify("password", "invalid-hash")
		if err != ErrInvalidHash {
			t.Errorf("expected ErrInvalidHash, got %v", err)
		}
	})

	t.Run("wrong algorithm", func(t *testing.T) {
		err := hasher.Verify("password", "$argon2i$v=19$m=65536,t=3,p=2$salt$hash")
		if err != ErrInvalidHash {
			t.Errorf("expected ErrInvalidHash, got %v", err)
		}
	})
}

func TestPasswordNeedsRehash(t *testing.T) {
	hasher := NewPasswordHasher(nil)

	t.Run("same params no rehash needed", func(t *testing.T) {
		hash, _ := hasher.Hash("password123")
		if hasher.NeedsRehash(hash) {
			t.Error("expected no rehash needed for same params")
		}
	})

	t.Run("different params needs rehash", func(t *testing.T) {
		oldHasher := NewPasswordHasher(&Argon2Params{
			Memory:      32 * 1024,
			Iterations:  2,
			Parallelism: 1,
			SaltLength:  16,
			KeyLength:   32,
		})
		hash, _ := oldHasher.Hash("password123")

		if !hasher.NeedsRehash(hash) {
			t.Error("expected rehash needed for different params")
		}
	})

	t.Run("invalid hash needs rehash", func(t *testing.T) {
		if !hasher.NeedsRehash("invalid-hash") {
			t.Error("expected rehash needed for invalid hash")
		}
	})
}

func TestGenerateRandomPassword(t *testing.T) {
	tests := []struct {
		name   string
		length int
		want   int
	}{
		{
			name:   "normal length",
			length: 16,
			want:   16,
		},
		{
			name:   "minimum length enforced",
			length: 4,
			want:   8,
		},
		{
			name:   "long password",
			length: 32,
			want:   32,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			password, err := GenerateRandomPassword(tt.length)
			if err != nil {
				t.Fatalf("GenerateRandomPassword() error = %v", err)
			}
			if len(password) != tt.want {
				t.Errorf("expected length %d, got %d", tt.want, len(password))
			}
		})
	}

	t.Run("unique passwords", func(t *testing.T) {
		passwords := make(map[string]bool)
		for i := 0; i < 100; i++ {
			p, _ := GenerateRandomPassword(16)
			if passwords[p] {
				t.Error("generated duplicate password")
			}
			passwords[p] = true
		}
	})
}

func TestGenerateResetToken(t *testing.T) {
	t.Run("generates token", func(t *testing.T) {
		token, err := GenerateResetToken()
		if err != nil {
			t.Fatalf("GenerateResetToken() error = %v", err)
		}
		if token == "" {
			t.Error("expected non-empty token")
		}
	})

	t.Run("unique tokens", func(t *testing.T) {
		tokens := make(map[string]bool)
		for i := 0; i < 100; i++ {
			token, _ := GenerateResetToken()
			if tokens[token] {
				t.Error("generated duplicate token")
			}
			tokens[token] = true
		}
	})
}

func TestValidatePasswordStrength(t *testing.T) {
	tests := []struct {
		name         string
		password     string
		minScore     int
		expectIssues bool
	}{
		{
			name:         "weak password - too short",
			password:     "abc",
			minScore:     0,
			expectIssues: true,
		},
		{
			name:         "weak password - only lowercase",
			password:     "abcdefgh",
			minScore:     2,
			expectIssues: true,
		},
		{
			name:         "medium password",
			password:     "Abcdefgh",
			minScore:     3,
			expectIssues: true,
		},
		{
			name:         "strong password",
			password:     "Abcdefgh1!",
			minScore:     5,
			expectIssues: false,
		},
		{
			name:         "very strong password",
			password:     "SecurePassword123!@#",
			minScore:     6,
			expectIssues: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score, issues := ValidatePasswordStrength(tt.password)
			if score < tt.minScore {
				t.Errorf("expected score >= %d, got %d", tt.minScore, score)
			}
			if tt.expectIssues && len(issues) == 0 {
				t.Error("expected issues but got none")
			}
			if !tt.expectIssues && len(issues) > 0 {
				t.Errorf("expected no issues but got: %v", issues)
			}
		})
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkPasswordHash(b *testing.B) {
	hasher := NewPasswordHasher(nil)
	password := "SecurePassword123!"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = hasher.Hash(password)
	}
}

func BenchmarkPasswordVerify(b *testing.B) {
	hasher := NewPasswordHasher(nil)
	password := "SecurePassword123!"
	hash, _ := hasher.Hash(password)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = hasher.Verify(password, hash)
	}
}

func BenchmarkJWTGenerate(b *testing.B) {
	config := &Config{
		SecretKey:           "test-secret-key-for-jwt-testing",
		AccessTokenDuration: 15 * time.Minute,
		Issuer:              "test-issuer",
	}
	manager := NewJWTManager(config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = manager.GenerateTokenPair("user-123", "test@example.com", "+380501234567", RoleCustomer)
	}
}

func BenchmarkJWTValidate(b *testing.B) {
	config := &Config{
		SecretKey:           "test-secret-key-for-jwt-testing",
		AccessTokenDuration: 15 * time.Minute,
		Issuer:              "test-issuer",
	}
	manager := NewJWTManager(config)
	tokenPair, _ := manager.GenerateTokenPair("user-123", "test@example.com", "+380501234567", RoleCustomer)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = manager.ValidateToken(tokenPair.AccessToken)
	}
}

// ============================================================================
// Fuzz Tests (Go 1.18+)
// ============================================================================

func FuzzPasswordHash(f *testing.F) {
	hasher := NewPasswordHasher(nil)

	// Seed corpus
	f.Add("password123")
	f.Add("SecurePass!")
	f.Add("")
	f.Add(strings.Repeat("a", 100))

	f.Fuzz(func(t *testing.T, password string) {
		hash, err := hasher.Hash(password)
		if len(password) < 8 || len(password) > 72 {
			// Should fail validation
			if err == nil {
				t.Errorf("expected error for password length %d", len(password))
			}
			return
		}

		if err != nil {
			t.Errorf("unexpected error: %v", err)
			return
		}

		// Verify the hash works
		if err := hasher.Verify(password, hash); err != nil {
			t.Errorf("failed to verify hashed password: %v", err)
		}
	})
}

// ============================================================================
// OAuth Tests
// ============================================================================

func TestNewGoogleOAuth(t *testing.T) {
	t.Run("with default scopes", func(t *testing.T) {
		config := &OAuthConfig{
			ClientID:     "test-client-id",
			ClientSecret: "test-client-secret",
			RedirectURL:  "http://localhost:8080/callback",
		}
		oauth := NewGoogleOAuth(config)
		if oauth == nil {
			t.Fatal("expected oauth to be created")
		}
		if len(oauth.config.Scopes) != 2 {
			t.Errorf("expected 2 default scopes, got %d", len(oauth.config.Scopes))
		}
	})

	t.Run("with custom scopes", func(t *testing.T) {
		config := &OAuthConfig{
			ClientID:     "test-client-id",
			ClientSecret: "test-client-secret",
			RedirectURL:  "http://localhost:8080/callback",
			Scopes:       []string{"email", "profile", "openid"},
		}
		oauth := NewGoogleOAuth(config)
		if len(oauth.config.Scopes) != 3 {
			t.Errorf("expected 3 scopes, got %d", len(oauth.config.Scopes))
		}
	})
}

func TestGoogleOAuthGetAuthURL(t *testing.T) {
	config := &OAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		RedirectURL:  "http://localhost:8080/callback",
		Scopes:       []string{"email", "profile"},
	}
	oauth := NewGoogleOAuth(config)

	url := oauth.GetAuthURL("test-state-123")

	if !strings.Contains(url, "https://accounts.google.com/o/oauth2/v2/auth") {
		t.Error("expected Google auth URL")
	}
	if !strings.Contains(url, "client_id=test-client-id") {
		t.Error("expected client_id in URL")
	}
	if !strings.Contains(url, "state=test-state-123") {
		t.Error("expected state in URL")
	}
	if !strings.Contains(url, "response_type=code") {
		t.Error("expected response_type=code in URL")
	}
	if !strings.Contains(url, "redirect_uri=") {
		t.Error("expected redirect_uri in URL")
	}
}

func TestNewFacebookOAuth(t *testing.T) {
	t.Run("with default scopes", func(t *testing.T) {
		config := &OAuthConfig{
			ClientID:     "test-client-id",
			ClientSecret: "test-client-secret",
			RedirectURL:  "http://localhost:8080/callback",
		}
		oauth := NewFacebookOAuth(config)
		if oauth == nil {
			t.Fatal("expected oauth to be created")
		}
		if len(oauth.config.Scopes) != 2 {
			t.Errorf("expected 2 default scopes, got %d", len(oauth.config.Scopes))
		}
	})

	t.Run("with custom scopes", func(t *testing.T) {
		config := &OAuthConfig{
			ClientID:     "test-client-id",
			ClientSecret: "test-client-secret",
			RedirectURL:  "http://localhost:8080/callback",
			Scopes:       []string{"email"},
		}
		oauth := NewFacebookOAuth(config)
		if len(oauth.config.Scopes) != 1 {
			t.Errorf("expected 1 scope, got %d", len(oauth.config.Scopes))
		}
	})
}

func TestFacebookOAuthGetAuthURL(t *testing.T) {
	config := &OAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		RedirectURL:  "http://localhost:8080/callback",
		Scopes:       []string{"email", "public_profile"},
	}
	oauth := NewFacebookOAuth(config)

	url := oauth.GetAuthURL("test-state-456")

	if !strings.Contains(url, "https://www.facebook.com/v18.0/dialog/oauth") {
		t.Error("expected Facebook auth URL")
	}
	if !strings.Contains(url, "client_id=test-client-id") {
		t.Error("expected client_id in URL")
	}
	if !strings.Contains(url, "state=test-state-456") {
		t.Error("expected state in URL")
	}
	if !strings.Contains(url, "response_type=code") {
		t.Error("expected response_type=code in URL")
	}
}

func TestOAuthManager(t *testing.T) {
	t.Run("new manager", func(t *testing.T) {
		manager := NewOAuthManager()
		if manager == nil {
			t.Fatal("expected manager to be created")
		}
	})

	t.Run("register and get provider", func(t *testing.T) {
		manager := NewOAuthManager()

		googleOAuth := NewGoogleOAuth(&OAuthConfig{
			ClientID:     "google-client-id",
			ClientSecret: "google-client-secret",
			RedirectURL:  "http://localhost:8080/callback/google",
		})

		manager.RegisterProvider(ProviderGoogle, googleOAuth)

		provider, ok := manager.GetProvider(ProviderGoogle)
		if !ok {
			t.Fatal("expected to get Google provider")
		}
		if provider == nil {
			t.Fatal("expected provider to not be nil")
		}
	})

	t.Run("get unknown provider", func(t *testing.T) {
		manager := NewOAuthManager()
		_, ok := manager.GetProvider(ProviderGoogle)
		if ok {
			t.Error("expected provider not found")
		}
	})

	t.Run("get auth URL", func(t *testing.T) {
		manager := NewOAuthManager()
		googleOAuth := NewGoogleOAuth(&OAuthConfig{
			ClientID:     "google-client-id",
			ClientSecret: "google-client-secret",
			RedirectURL:  "http://localhost:8080/callback/google",
		})
		manager.RegisterProvider(ProviderGoogle, googleOAuth)

		url, err := manager.GetAuthURL(ProviderGoogle, "test-state")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(url, "accounts.google.com") {
			t.Error("expected Google auth URL")
		}
	})

	t.Run("get auth URL unknown provider", func(t *testing.T) {
		manager := NewOAuthManager()
		_, err := manager.GetAuthURL(ProviderFacebook, "test-state")
		if err == nil {
			t.Error("expected error for unknown provider")
		}
	})
}

func TestOAuthUserStruct(t *testing.T) {
	user := OAuthUser{
		Provider:  ProviderGoogle,
		ID:        "google-123",
		Email:     "test@gmail.com",
		Name:      "Test User",
		FirstName: "Test",
		LastName:  "User",
		AvatarURL: "https://example.com/avatar.jpg",
		Verified:  true,
	}

	if user.Provider != ProviderGoogle {
		t.Errorf("expected provider google, got %s", user.Provider)
	}
	if user.ID != "google-123" {
		t.Errorf("expected ID google-123, got %s", user.ID)
	}
	if !user.Verified {
		t.Error("expected verified to be true")
	}
}

func TestOAuthTokensStruct(t *testing.T) {
	tokens := OAuthTokens{
		AccessToken:  "access-token-123",
		RefreshToken: "refresh-token-456",
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		Scope:        "email profile",
		IDToken:      "id-token-789",
	}

	if tokens.AccessToken != "access-token-123" {
		t.Errorf("expected access token, got %s", tokens.AccessToken)
	}
	if tokens.ExpiresIn != 3600 {
		t.Errorf("expected expires_in 3600, got %d", tokens.ExpiresIn)
	}
}

func TestOAuthProviderConstants(t *testing.T) {
	if ProviderGoogle != "google" {
		t.Errorf("expected provider google, got %s", ProviderGoogle)
	}
	if ProviderFacebook != "facebook" {
		t.Errorf("expected provider facebook, got %s", ProviderFacebook)
	}
}

func TestOAuthErrors(t *testing.T) {
	if ErrOAuthStateMismatch == nil {
		t.Error("expected ErrOAuthStateMismatch to be defined")
	}
	if ErrOAuthCodeExchange == nil {
		t.Error("expected ErrOAuthCodeExchange to be defined")
	}
	if ErrOAuthUserInfo == nil {
		t.Error("expected ErrOAuthUserInfo to be defined")
	}
}

// ============================================================================
// Service Tests
// ============================================================================

// MockUserRepository implements UserRepository for testing
type MockUserRepository struct {
	users        map[string]*User
	emailIndex   map[string]*User
	phoneIndex   map[string]*User
	googleIndex  map[string]*User
	facebookIndex map[string]*User
	telegramIndex map[int64]*User
	createError  error
	getError     error
	updateError  error
	deleteError  error
}

func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		users:        make(map[string]*User),
		emailIndex:   make(map[string]*User),
		phoneIndex:   make(map[string]*User),
		googleIndex:  make(map[string]*User),
		facebookIndex: make(map[string]*User),
		telegramIndex: make(map[int64]*User),
	}
}

func (m *MockUserRepository) Create(ctx context.Context, user *User) error {
	if m.createError != nil {
		return m.createError
	}
	if user.ID == "" {
		user.ID = "user-" + time.Now().Format("20060102150405")
	}
	m.users[user.ID] = user
	if user.Email != "" {
		m.emailIndex[user.Email] = user
	}
	if user.Phone != "" {
		m.phoneIndex[user.Phone] = user
	}
	if user.GoogleID != "" {
		m.googleIndex[user.GoogleID] = user
	}
	if user.FacebookID != "" {
		m.facebookIndex[user.FacebookID] = user
	}
	if user.TelegramID != 0 {
		m.telegramIndex[user.TelegramID] = user
	}
	return nil
}

func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*User, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	user, ok := m.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	user, ok := m.emailIndex[email]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (m *MockUserRepository) GetByPhone(ctx context.Context, phone string) (*User, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	user, ok := m.phoneIndex[phone]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (m *MockUserRepository) GetByTelegramID(ctx context.Context, telegramID int64) (*User, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	user, ok := m.telegramIndex[telegramID]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (m *MockUserRepository) GetByGoogleID(ctx context.Context, googleID string) (*User, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	user, ok := m.googleIndex[googleID]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (m *MockUserRepository) GetByFacebookID(ctx context.Context, facebookID string) (*User, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	user, ok := m.facebookIndex[facebookID]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (m *MockUserRepository) Update(ctx context.Context, user *User) error {
	if m.updateError != nil {
		return m.updateError
	}
	m.users[user.ID] = user
	if user.Email != "" {
		m.emailIndex[user.Email] = user
	}
	if user.Phone != "" {
		m.phoneIndex[user.Phone] = user
	}
	return nil
}

func (m *MockUserRepository) UpdateLastLogin(ctx context.Context, id string) error {
	user, ok := m.users[id]
	if !ok {
		return ErrUserNotFound
	}
	user.LastLoginAt = time.Now()
	return nil
}

func (m *MockUserRepository) Delete(ctx context.Context, id string) error {
	if m.deleteError != nil {
		return m.deleteError
	}
	delete(m.users, id)
	return nil
}

func (m *MockUserRepository) List(ctx context.Context, limit, offset int) ([]*User, int, error) {
	users := make([]*User, 0, len(m.users))
	for _, u := range m.users {
		users = append(users, u)
	}
	total := len(users)
	if offset >= len(users) {
		return []*User{}, total, nil
	}
	end := offset + limit
	if end > len(users) {
		end = len(users)
	}
	return users[offset:end], total, nil
}

// MockSessionRepository implements SessionRepository for testing
type MockSessionRepository struct {
	sessions    map[string]*Session
	createError error
	getError    error
	deleteError error
}

func NewMockSessionRepository() *MockSessionRepository {
	return &MockSessionRepository{
		sessions: make(map[string]*Session),
	}
}

func (m *MockSessionRepository) Create(ctx context.Context, session *Session) error {
	if m.createError != nil {
		return m.createError
	}
	m.sessions[session.TokenHash] = session
	return nil
}

func (m *MockSessionRepository) GetByToken(ctx context.Context, tokenHash string) (*Session, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	session, ok := m.sessions[tokenHash]
	if !ok {
		return nil, errors.New("session not found")
	}
	return session, nil
}

func (m *MockSessionRepository) DeleteByToken(ctx context.Context, tokenHash string) error {
	if m.deleteError != nil {
		return m.deleteError
	}
	delete(m.sessions, tokenHash)
	return nil
}

func (m *MockSessionRepository) DeleteByUserID(ctx context.Context, userID string) error {
	if m.deleteError != nil {
		return m.deleteError
	}
	for hash, session := range m.sessions {
		if session.UserID == userID {
			delete(m.sessions, hash)
		}
	}
	return nil
}

func (m *MockSessionRepository) DeleteExpired(ctx context.Context) error {
	now := time.Now()
	for hash, session := range m.sessions {
		if session.ExpiresAt.Before(now) {
			delete(m.sessions, hash)
		}
	}
	return nil
}

func createTestService() (*Service, *MockUserRepository, *MockSessionRepository) {
	userRepo := NewMockUserRepository()
	sessionRepo := NewMockSessionRepository()
	jwtManager := NewJWTManager(&Config{
		SecretKey:            "test-secret-key-for-jwt-testing",
		AccessTokenDuration:  15 * time.Minute,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		Issuer:               "test-issuer",
	})
	oauthManager := NewOAuthManager()

	service := NewService(userRepo, sessionRepo, jwtManager, oauthManager)
	return service, userRepo, sessionRepo
}

func TestNewService(t *testing.T) {
	service, _, _ := createTestService()
	if service == nil {
		t.Fatal("expected service to be created")
	}
}

func TestServiceRegister(t *testing.T) {
	t.Run("successful registration with email", func(t *testing.T) {
		service, _, _ := createTestService()

		req := &RegisterRequest{
			Email:     "test@example.com",
			Password:  "SecurePass123!",
			FirstName: "Test",
			LastName:  "User",
		}

		user, tokens, err := service.Register(context.Background(), req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user == nil {
			t.Fatal("expected user to be created")
		}
		if user.Email != "test@example.com" {
			t.Errorf("expected email test@example.com, got %s", user.Email)
		}
		if user.Role != RoleCustomer {
			t.Errorf("expected role customer, got %s", user.Role)
		}
		if tokens == nil {
			t.Fatal("expected tokens to be generated")
		}
		if tokens.AccessToken == "" {
			t.Error("expected access token")
		}
	})

	t.Run("successful registration with phone", func(t *testing.T) {
		service, _, _ := createTestService()

		req := &RegisterRequest{
			Phone:     "+380501234567",
			Password:  "SecurePass123!",
			FirstName: "Test",
			LastName:  "User",
		}

		user, tokens, err := service.Register(context.Background(), req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.Phone != "+380501234567" {
			t.Errorf("expected phone +380501234567, got %s", user.Phone)
		}
		if tokens == nil {
			t.Fatal("expected tokens")
		}
	})

	t.Run("duplicate email", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		// Create existing user
		existingUser := &User{
			ID:    "existing-user",
			Email: "existing@example.com",
		}
		userRepo.Create(context.Background(), existingUser)

		req := &RegisterRequest{
			Email:    "existing@example.com",
			Password: "SecurePass123!",
		}

		_, _, err := service.Register(context.Background(), req)
		if err != ErrUserExists {
			t.Errorf("expected ErrUserExists, got %v", err)
		}
	})

	t.Run("duplicate phone", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		existingUser := &User{
			ID:    "existing-user",
			Phone: "+380501234567",
		}
		userRepo.Create(context.Background(), existingUser)

		req := &RegisterRequest{
			Phone:    "+380501234567",
			Password: "SecurePass123!",
		}

		_, _, err := service.Register(context.Background(), req)
		if err != ErrUserExists {
			t.Errorf("expected ErrUserExists, got %v", err)
		}
	})

	t.Run("weak password", func(t *testing.T) {
		service, _, _ := createTestService()

		req := &RegisterRequest{
			Email:    "test@example.com",
			Password: "123", // Too short
		}

		_, _, err := service.Register(context.Background(), req)
		if err != ErrPasswordTooShort {
			t.Errorf("expected ErrPasswordTooShort, got %v", err)
		}
	})
}

func TestServiceLogin(t *testing.T) {
	t.Run("successful login with email", func(t *testing.T) {
		service, _, _ := createTestService()

		// Register user first
		registerReq := &RegisterRequest{
			Email:    "test@example.com",
			Password: "SecurePass123!",
		}
		service.Register(context.Background(), registerReq)

		// Login
		loginReq := &LoginRequest{
			Email:    "test@example.com",
			Password: "SecurePass123!",
		}
		user, tokens, err := service.Login(context.Background(), loginReq)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user == nil {
			t.Fatal("expected user")
		}
		if tokens == nil {
			t.Fatal("expected tokens")
		}
	})

	t.Run("successful login with phone", func(t *testing.T) {
		service, _, _ := createTestService()

		registerReq := &RegisterRequest{
			Phone:    "+380501234567",
			Password: "SecurePass123!",
		}
		service.Register(context.Background(), registerReq)

		loginReq := &LoginRequest{
			Phone:    "+380501234567",
			Password: "SecurePass123!",
		}
		user, tokens, err := service.Login(context.Background(), loginReq)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user == nil {
			t.Fatal("expected user")
		}
		if tokens == nil {
			t.Fatal("expected tokens")
		}
	})

	t.Run("wrong password", func(t *testing.T) {
		service, _, _ := createTestService()

		registerReq := &RegisterRequest{
			Email:    "test@example.com",
			Password: "SecurePass123!",
		}
		service.Register(context.Background(), registerReq)

		loginReq := &LoginRequest{
			Email:    "test@example.com",
			Password: "WrongPassword!",
		}
		_, _, err := service.Login(context.Background(), loginReq)
		if err != ErrInvalidCredentials {
			t.Errorf("expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("user not found", func(t *testing.T) {
		service, _, _ := createTestService()

		loginReq := &LoginRequest{
			Email:    "notfound@example.com",
			Password: "SecurePass123!",
		}
		_, _, err := service.Login(context.Background(), loginReq)
		if err != ErrInvalidCredentials {
			t.Errorf("expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("no email or phone", func(t *testing.T) {
		service, _, _ := createTestService()

		loginReq := &LoginRequest{
			Password: "SecurePass123!",
		}
		_, _, err := service.Login(context.Background(), loginReq)
		if err != ErrInvalidCredentials {
			t.Errorf("expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("disabled account", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		hasher := NewPasswordHasher(nil)
		hash, _ := hasher.Hash("SecurePass123!")

		disabledUser := &User{
			ID:           "disabled-user",
			Email:        "disabled@example.com",
			PasswordHash: hash,
			IsActive:     false,
		}
		userRepo.Create(context.Background(), disabledUser)

		loginReq := &LoginRequest{
			Email:    "disabled@example.com",
			Password: "SecurePass123!",
		}
		_, _, err := service.Login(context.Background(), loginReq)
		if err != ErrAccountDisabled {
			t.Errorf("expected ErrAccountDisabled, got %v", err)
		}
	})
}

func TestServiceLoginWithOAuth(t *testing.T) {
	t.Run("new user registration via OAuth", func(t *testing.T) {
		service, _, _ := createTestService()

		oauthUser := &OAuthUser{
			Provider:  ProviderGoogle,
			ID:        "google-123",
			Email:     "oauth@gmail.com",
			Name:      "OAuth User",
			FirstName: "OAuth",
			LastName:  "User",
			Verified:  true,
		}

		user, tokens, err := service.LoginWithOAuth(context.Background(), oauthUser)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user == nil {
			t.Fatal("expected user")
		}
		if user.GoogleID != "google-123" {
			t.Errorf("expected Google ID google-123, got %s", user.GoogleID)
		}
		if tokens == nil {
			t.Fatal("expected tokens")
		}
	})

	t.Run("existing user login via OAuth", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		existingUser := &User{
			ID:       "existing-oauth-user",
			Email:    "existing@gmail.com",
			GoogleID: "google-456",
			IsActive: true,
		}
		userRepo.Create(context.Background(), existingUser)

		oauthUser := &OAuthUser{
			Provider: ProviderGoogle,
			ID:       "google-456",
			Email:    "existing@gmail.com",
		}

		user, tokens, err := service.LoginWithOAuth(context.Background(), oauthUser)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.ID != "existing-oauth-user" {
			t.Errorf("expected existing user ID, got %s", user.ID)
		}
		if tokens == nil {
			t.Fatal("expected tokens")
		}
	})

	t.Run("link OAuth to existing email user", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		existingUser := &User{
			ID:       "email-user",
			Email:    "user@gmail.com",
			IsActive: true,
		}
		userRepo.Create(context.Background(), existingUser)

		oauthUser := &OAuthUser{
			Provider:  ProviderFacebook,
			ID:        "fb-789",
			Email:     "user@gmail.com",
			FirstName: "FB",
			LastName:  "User",
		}

		user, _, err := service.LoginWithOAuth(context.Background(), oauthUser)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.FacebookID != "fb-789" {
			t.Errorf("expected Facebook ID to be linked, got %s", user.FacebookID)
		}
	})

	t.Run("disabled OAuth user", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		disabledUser := &User{
			ID:       "disabled-oauth",
			Email:    "disabled@gmail.com",
			GoogleID: "google-disabled",
			IsActive: false,
		}
		userRepo.Create(context.Background(), disabledUser)

		oauthUser := &OAuthUser{
			Provider: ProviderGoogle,
			ID:       "google-disabled",
			Email:    "disabled@gmail.com",
		}

		_, _, err := service.LoginWithOAuth(context.Background(), oauthUser)
		if err != ErrAccountDisabled {
			t.Errorf("expected ErrAccountDisabled, got %v", err)
		}
	})
}

func TestServiceRefreshToken(t *testing.T) {
	t.Run("successful refresh", func(t *testing.T) {
		service, _, _ := createTestService()

		// Register and get tokens
		registerReq := &RegisterRequest{
			Email:    "test@example.com",
			Password: "SecurePass123!",
		}
		_, tokens, _ := service.Register(context.Background(), registerReq)

		// Refresh
		newTokens, err := service.RefreshToken(context.Background(), tokens.RefreshToken)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if newTokens == nil {
			t.Fatal("expected new tokens")
		}
		if newTokens.AccessToken == tokens.AccessToken {
			t.Error("expected new access token to be different")
		}
	})

	t.Run("invalid refresh token", func(t *testing.T) {
		service, _, _ := createTestService()

		_, err := service.RefreshToken(context.Background(), "invalid-token")
		if err == nil {
			t.Error("expected error for invalid refresh token")
		}
	})
}

func TestServiceLogout(t *testing.T) {
	service, _, sessionRepo := createTestService()

	// Create session
	session := &Session{
		ID:        "session-1",
		UserID:    "user-123",
		TokenHash: "token-hash",
	}
	sessionRepo.Create(context.Background(), session)

	// Logout
	err := service.Logout(context.Background(), "user-123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestServiceGetUser(t *testing.T) {
	t.Run("existing user", func(t *testing.T) {
		service, userRepo, _ := createTestService()

		existingUser := &User{
			ID:    "user-123",
			Email: "test@example.com",
		}
		userRepo.Create(context.Background(), existingUser)

		user, err := service.GetUser(context.Background(), "user-123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.Email != "test@example.com" {
			t.Errorf("expected email test@example.com, got %s", user.Email)
		}
	})

	t.Run("user not found", func(t *testing.T) {
		service, _, _ := createTestService()

		_, err := service.GetUser(context.Background(), "nonexistent")
		if err != ErrUserNotFound {
			t.Errorf("expected ErrUserNotFound, got %v", err)
		}
	})
}

func TestServiceUpdateUser(t *testing.T) {
	service, userRepo, _ := createTestService()

	user := &User{
		ID:        "user-123",
		Email:     "test@example.com",
		FirstName: "Old",
	}
	userRepo.Create(context.Background(), user)

	user.FirstName = "New"
	err := service.UpdateUser(context.Background(), user)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	updated, _ := service.GetUser(context.Background(), "user-123")
	if updated.FirstName != "New" {
		t.Errorf("expected FirstName New, got %s", updated.FirstName)
	}
}

func TestServiceChangePassword(t *testing.T) {
	t.Run("successful change", func(t *testing.T) {
		service, _, _ := createTestService()

		registerReq := &RegisterRequest{
			Email:    "test@example.com",
			Password: "OldPassword123!",
		}
		user, _, _ := service.Register(context.Background(), registerReq)

		err := service.ChangePassword(context.Background(), user.ID, "OldPassword123!", "NewPassword456!")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Try login with new password
		loginReq := &LoginRequest{
			Email:    "test@example.com",
			Password: "NewPassword456!",
		}
		_, _, err = service.Login(context.Background(), loginReq)
		if err != nil {
			t.Errorf("expected login with new password to succeed: %v", err)
		}
	})

	t.Run("wrong old password", func(t *testing.T) {
		service, _, _ := createTestService()

		registerReq := &RegisterRequest{
			Email:    "test@example.com",
			Password: "OldPassword123!",
		}
		user, _, _ := service.Register(context.Background(), registerReq)

		err := service.ChangePassword(context.Background(), user.ID, "WrongPassword!", "NewPassword456!")
		if err != ErrInvalidCredentials {
			t.Errorf("expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("user not found", func(t *testing.T) {
		service, _, _ := createTestService()

		err := service.ChangePassword(context.Background(), "nonexistent", "OldPass123!", "NewPass456!")
		if err != ErrUserNotFound {
			t.Errorf("expected ErrUserNotFound, got %v", err)
		}
	})
}

func TestServiceListUsers(t *testing.T) {
	service, userRepo, _ := createTestService()

	// Create multiple users
	for i := 0; i < 5; i++ {
		user := &User{
			ID:    "user-" + string(rune('a'+i)),
			Email: "user" + string(rune('a'+i)) + "@example.com",
		}
		userRepo.Create(context.Background(), user)
	}

	t.Run("list all users", func(t *testing.T) {
		users, total, err := service.ListUsers(context.Background(), 10, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 5 {
			t.Errorf("expected total 5, got %d", total)
		}
		if len(users) != 5 {
			t.Errorf("expected 5 users, got %d", len(users))
		}
	})

	t.Run("paginated list", func(t *testing.T) {
		users, total, err := service.ListUsers(context.Background(), 2, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 5 {
			t.Errorf("expected total 5, got %d", total)
		}
		if len(users) != 2 {
			t.Errorf("expected 2 users, got %d", len(users))
		}
	})
}

func TestUserStruct(t *testing.T) {
	now := time.Now()
	user := User{
		ID:            "user-123",
		Email:         "test@example.com",
		Phone:         "+380501234567",
		PasswordHash:  "hashed",
		FirstName:     "Test",
		LastName:      "User",
		AvatarURL:     "https://example.com/avatar.jpg",
		Role:          RoleCustomer,
		TelegramID:    123456789,
		GoogleID:      "google-id",
		FacebookID:    "facebook-id",
		EmailVerified: true,
		PhoneVerified: false,
		IsActive:      true,
		LastLoginAt:   now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if user.ID != "user-123" {
		t.Errorf("expected ID user-123, got %s", user.ID)
	}
	if user.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", user.Email)
	}
	if user.TelegramID != 123456789 {
		t.Errorf("expected TelegramID 123456789, got %d", user.TelegramID)
	}
}

func TestSessionStruct(t *testing.T) {
	now := time.Now()
	session := Session{
		ID:               "session-123",
		UserID:           "user-456",
		TokenHash:        "token-hash",
		RefreshTokenHash: "refresh-hash",
		UserAgent:        "Mozilla/5.0",
		IPAddress:        "192.168.1.1",
		ExpiresAt:        now.Add(24 * time.Hour),
		CreatedAt:        now,
	}

	if session.ID != "session-123" {
		t.Errorf("expected ID session-123, got %s", session.ID)
	}
	if session.UserID != "user-456" {
		t.Errorf("expected UserID user-456, got %s", session.UserID)
	}
}

func TestRegisterRequestStruct(t *testing.T) {
	req := RegisterRequest{
		Email:     "test@example.com",
		Phone:     "+380501234567",
		Password:  "SecurePass123!",
		FirstName: "Test",
		LastName:  "User",
	}

	if req.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", req.Email)
	}
}

func TestLoginRequestStruct(t *testing.T) {
	req := LoginRequest{
		Email:    "test@example.com",
		Phone:    "+380501234567",
		Password: "SecurePass123!",
	}

	if req.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", req.Email)
	}
}

func TestServiceErrors(t *testing.T) {
	if ErrUserNotFound == nil {
		t.Error("expected ErrUserNotFound to be defined")
	}
	if ErrUserExists == nil {
		t.Error("expected ErrUserExists to be defined")
	}
	if ErrInvalidCredentials == nil {
		t.Error("expected ErrInvalidCredentials to be defined")
	}
	if ErrAccountDisabled == nil {
		t.Error("expected ErrAccountDisabled to be defined")
	}
	if ErrEmailNotVerified == nil {
		t.Error("expected ErrEmailNotVerified to be defined")
	}
}

// ============================================================================
// Additional Benchmark Tests
// ============================================================================

func BenchmarkServiceRegister(b *testing.B) {
	service, _, _ := createTestService()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := &RegisterRequest{
			Email:    "bench" + string(rune(i%1000)) + "@example.com",
			Password: "SecurePass123!",
		}
		_, _, _ = service.Register(context.Background(), req)
	}
}

func BenchmarkServiceLogin(b *testing.B) {
	service, _, _ := createTestService()

	// Setup user
	req := &RegisterRequest{
		Email:    "bench@example.com",
		Password: "SecurePass123!",
	}
	service.Register(context.Background(), req)

	loginReq := &LoginRequest{
		Email:    "bench@example.com",
		Password: "SecurePass123!",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, _ = service.Login(context.Background(), loginReq)
	}
}
