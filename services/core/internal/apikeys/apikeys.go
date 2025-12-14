package apikeys

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"
)

// Errors
var (
	ErrKeyNotFound      = errors.New("API key not found")
	ErrKeyRevoked       = errors.New("API key has been revoked")
	ErrInvalidKey       = errors.New("invalid API key format")
	ErrPermissionDenied = errors.New("permission denied")
)

// APIKey represents an API key for a tenant
type APIKey struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	KeyPrefix   string    `json:"key_prefix"`   // First 8 chars for display
	KeyHash     string    `json:"-"`            // SHA256 hash of full key
	Permissions []string  `json:"permissions"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
}

// CreateKeyInput for creating a new API key
type CreateKeyInput struct {
	TenantID    string
	Name        string
	Permissions []string
	ExpiresAt   *time.Time
}

// CreateKeyResult contains the newly created key (shown only once)
type CreateKeyResult struct {
	ID        string   `json:"id"`
	APIKey    string   `json:"api_key"`
	SecretKey string   `json:"secret_key"`
	Name      string   `json:"name"`
	Permissions []string `json:"permissions"`
}

// Repository interface for API key storage
type Repository interface {
	Create(ctx context.Context, key *APIKey) error
	GetByHash(ctx context.Context, keyHash string) (*APIKey, error)
	GetByID(ctx context.Context, id string) (*APIKey, error)
	ListByTenant(ctx context.Context, tenantID string) ([]*APIKey, error)
	UpdateLastUsed(ctx context.Context, id string, timestamp time.Time) error
	Revoke(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
}

// Service handles API key operations
type Service struct {
	repo Repository
}

// NewService creates a new API key service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create generates a new API key
func (s *Service) Create(ctx context.Context, input CreateKeyInput) (*CreateKeyResult, error) {
	// Generate key pair
	apiKey := generateAPIKey()
	secretKey := generateSecretKey()

	// Hash the keys for storage
	keyHash := hashKey(apiKey + ":" + secretKey)

	key := &APIKey{
		ID:          generateID(),
		TenantID:    input.TenantID,
		Name:        input.Name,
		KeyPrefix:   apiKey[:12], // Show first 12 chars
		KeyHash:     keyHash,
		Permissions: input.Permissions,
		ExpiresAt:   input.ExpiresAt,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.Create(ctx, key); err != nil {
		return nil, err
	}

	return &CreateKeyResult{
		ID:          key.ID,
		APIKey:      apiKey,
		SecretKey:   secretKey,
		Name:        key.Name,
		Permissions: key.Permissions,
	}, nil
}

// Validate checks if an API key is valid and returns the key info
func (s *Service) Validate(ctx context.Context, apiKey, secretKey string) (*APIKey, error) {
	if apiKey == "" || secretKey == "" {
		return nil, ErrInvalidKey
	}

	// Hash and lookup
	keyHash := hashKey(apiKey + ":" + secretKey)
	key, err := s.repo.GetByHash(ctx, keyHash)
	if err != nil {
		return nil, ErrKeyNotFound
	}

	// Check if revoked
	if key.RevokedAt != nil {
		return nil, ErrKeyRevoked
	}

	// Check expiration
	if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
		return nil, ErrKeyRevoked
	}

	// Update last used
	go s.repo.UpdateLastUsed(context.Background(), key.ID, time.Now())

	return key, nil
}

// HasPermission checks if key has specific permission
func (s *Service) HasPermission(key *APIKey, permission string) bool {
	for _, p := range key.Permissions {
		if p == permission || p == "admin" {
			return true
		}
		// Check wildcard permissions (e.g., "read:*" matches "read:products")
		if len(p) > 2 && p[len(p)-1] == '*' {
			prefix := p[:len(p)-1]
			if len(permission) >= len(prefix) && permission[:len(prefix)] == prefix {
				return true
			}
		}
	}
	return false
}

// List returns all API keys for a tenant
func (s *Service) List(ctx context.Context, tenantID string) ([]*APIKey, error) {
	return s.repo.ListByTenant(ctx, tenantID)
}

// Revoke disables an API key
func (s *Service) Revoke(ctx context.Context, keyID string) error {
	return s.repo.Revoke(ctx, keyID)
}

// Delete permanently removes an API key
func (s *Service) Delete(ctx context.Context, keyID string) error {
	return s.repo.Delete(ctx, keyID)
}

// Helper functions

func generateAPIKey() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return "shop_live_" + hex.EncodeToString(bytes)
}

func generateSecretKey() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return "shop_secret_" + hex.EncodeToString(bytes)
}

func generateID() string {
	bytes := make([]byte, 12)
	rand.Read(bytes)
	return "key_" + hex.EncodeToString(bytes)
}

func hashKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// ==================== AVAILABLE PERMISSIONS ====================

var AvailablePermissions = []string{
	"read:products",
	"write:products",
	"read:orders",
	"write:orders",
	"read:customers",
	"write:customers",
	"read:analytics",
	"read:inventory",
	"write:inventory",
	"admin",
}

func IsValidPermission(perm string) bool {
	for _, p := range AvailablePermissions {
		if p == perm {
			return true
		}
	}
	return false
}
