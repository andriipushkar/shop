package auth

import (
	"context"
	"errors"
	"time"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrUserExists         = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrEmailNotVerified   = errors.New("email not verified")
)

// User represents a user entity
type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email,omitempty"`
	Phone         string    `json:"phone,omitempty"`
	PasswordHash  string    `json:"-"`
	FirstName     string    `json:"first_name,omitempty"`
	LastName      string    `json:"last_name,omitempty"`
	AvatarURL     string    `json:"avatar_url,omitempty"`
	Role          Role      `json:"role"`
	TelegramID    int64     `json:"telegram_id,omitempty"`
	GoogleID      string    `json:"google_id,omitempty"`
	FacebookID    string    `json:"facebook_id,omitempty"`
	EmailVerified bool      `json:"email_verified"`
	PhoneVerified bool      `json:"phone_verified"`
	IsActive      bool      `json:"is_active"`
	LastLoginAt   time.Time `json:"last_login_at,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// RegisterRequest represents registration request
type RegisterRequest struct {
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// LoginRequest represents login request
type LoginRequest struct {
	Email    string `json:"email,omitempty"`
	Phone    string `json:"phone,omitempty"`
	Password string `json:"password"`
}

// UserRepository defines user storage interface
type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByPhone(ctx context.Context, phone string) (*User, error)
	GetByTelegramID(ctx context.Context, telegramID int64) (*User, error)
	GetByGoogleID(ctx context.Context, googleID string) (*User, error)
	GetByFacebookID(ctx context.Context, facebookID string) (*User, error)
	Update(ctx context.Context, user *User) error
	UpdateLastLogin(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, limit, offset int) ([]*User, int, error)
}

// SessionRepository defines session storage interface
type SessionRepository interface {
	Create(ctx context.Context, session *Session) error
	GetByToken(ctx context.Context, tokenHash string) (*Session, error)
	DeleteByToken(ctx context.Context, tokenHash string) error
	DeleteByUserID(ctx context.Context, userID string) error
	DeleteExpired(ctx context.Context) error
}

// Session represents a user session
type Session struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	TokenHash        string    `json:"-"`
	RefreshTokenHash string    `json:"-"`
	UserAgent        string    `json:"user_agent"`
	IPAddress        string    `json:"ip_address"`
	ExpiresAt        time.Time `json:"expires_at"`
	CreatedAt        time.Time `json:"created_at"`
}

// Service handles authentication business logic
type Service struct {
	userRepo     UserRepository
	sessionRepo  SessionRepository
	jwtManager   *JWTManager
	hasher       *PasswordHasher
	oauthManager *OAuthManager
}

// NewService creates a new auth service
func NewService(
	userRepo UserRepository,
	sessionRepo SessionRepository,
	jwtManager *JWTManager,
	oauthManager *OAuthManager,
) *Service {
	return &Service{
		userRepo:     userRepo,
		sessionRepo:  sessionRepo,
		jwtManager:   jwtManager,
		hasher:       NewPasswordHasher(nil),
		oauthManager: oauthManager,
	}
}

// Register registers a new user
func (s *Service) Register(ctx context.Context, req *RegisterRequest) (*User, *TokenPair, error) {
	// Check if user exists
	if req.Email != "" {
		existing, _ := s.userRepo.GetByEmail(ctx, req.Email)
		if existing != nil {
			return nil, nil, ErrUserExists
		}
	}

	if req.Phone != "" {
		existing, _ := s.userRepo.GetByPhone(ctx, req.Phone)
		if existing != nil {
			return nil, nil, ErrUserExists
		}
	}

	// Hash password
	passwordHash, err := s.hasher.Hash(req.Password)
	if err != nil {
		return nil, nil, err
	}

	// Create user
	user := &User{
		Email:        req.Email,
		Phone:        req.Phone,
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         RoleCustomer,
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, nil, err
	}

	// Generate tokens
	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Email, user.Phone, user.Role)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// Login authenticates a user
func (s *Service) Login(ctx context.Context, req *LoginRequest) (*User, *TokenPair, error) {
	var user *User
	var err error

	// Find user by email or phone
	if req.Email != "" {
		user, err = s.userRepo.GetByEmail(ctx, req.Email)
	} else if req.Phone != "" {
		user, err = s.userRepo.GetByPhone(ctx, req.Phone)
	} else {
		return nil, nil, ErrInvalidCredentials
	}

	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	// Check if account is active
	if !user.IsActive {
		return nil, nil, ErrAccountDisabled
	}

	// Verify password
	if err := s.hasher.Verify(req.Password, user.PasswordHash); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Generate tokens
	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Email, user.Phone, user.Role)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// LoginWithOAuth authenticates or registers user via OAuth
func (s *Service) LoginWithOAuth(ctx context.Context, oauthUser *OAuthUser) (*User, *TokenPair, error) {
	var user *User
	var err error

	// Try to find existing user
	switch oauthUser.Provider {
	case ProviderGoogle:
		user, err = s.userRepo.GetByGoogleID(ctx, oauthUser.ID)
	case ProviderFacebook:
		user, err = s.userRepo.GetByFacebookID(ctx, oauthUser.ID)
	}

	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, nil, err
	}

	// If not found by provider ID, try by email
	if user == nil && oauthUser.Email != "" {
		user, _ = s.userRepo.GetByEmail(ctx, oauthUser.Email)
	}

	// Create new user if not found
	if user == nil {
		user = &User{
			Email:         oauthUser.Email,
			FirstName:     oauthUser.FirstName,
			LastName:      oauthUser.LastName,
			AvatarURL:     oauthUser.AvatarURL,
			Role:          RoleCustomer,
			EmailVerified: oauthUser.Verified,
			IsActive:      true,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}

		switch oauthUser.Provider {
		case ProviderGoogle:
			user.GoogleID = oauthUser.ID
		case ProviderFacebook:
			user.FacebookID = oauthUser.ID
		}

		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, nil, err
		}
	} else {
		// Update OAuth ID if not set
		updated := false
		switch oauthUser.Provider {
		case ProviderGoogle:
			if user.GoogleID == "" {
				user.GoogleID = oauthUser.ID
				updated = true
			}
		case ProviderFacebook:
			if user.FacebookID == "" {
				user.FacebookID = oauthUser.ID
				updated = true
			}
		}

		if updated {
			user.UpdatedAt = time.Now()
			if err := s.userRepo.Update(ctx, user); err != nil {
				return nil, nil, err
			}
		}
	}

	// Check if account is active
	if !user.IsActive {
		return nil, nil, ErrAccountDisabled
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Generate tokens
	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Email, user.Phone, user.Role)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// RefreshToken refreshes access token
func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	return s.jwtManager.RefreshTokens(refreshToken, func(userID string) (Role, string, string, error) {
		user, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return "", "", "", err
		}
		return user.Role, user.Email, user.Phone, nil
	})
}

// Logout invalidates user session
func (s *Service) Logout(ctx context.Context, userID string) error {
	return s.sessionRepo.DeleteByUserID(ctx, userID)
}

// GetUser returns user by ID
func (s *Service) GetUser(ctx context.Context, id string) (*User, error) {
	return s.userRepo.GetByID(ctx, id)
}

// UpdateUser updates user profile
func (s *Service) UpdateUser(ctx context.Context, user *User) error {
	user.UpdatedAt = time.Now()
	return s.userRepo.Update(ctx, user)
}

// ChangePassword changes user password
func (s *Service) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Verify old password
	if err := s.hasher.Verify(oldPassword, user.PasswordHash); err != nil {
		return ErrInvalidCredentials
	}

	// Hash new password
	passwordHash, err := s.hasher.Hash(newPassword)
	if err != nil {
		return err
	}

	user.PasswordHash = passwordHash
	user.UpdatedAt = time.Now()

	return s.userRepo.Update(ctx, user)
}

// ListUsers returns paginated list of users (admin only)
func (s *Service) ListUsers(ctx context.Context, limit, offset int) ([]*User, int, error) {
	return s.userRepo.List(ctx, limit, offset)
}
