package apikeys

import (
	"context"
	"testing"
	"time"
)

// MockRepository for testing
type MockRepository struct {
	keys       map[string]*APIKey
	keysByHash map[string]*APIKey
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		keys:       make(map[string]*APIKey),
		keysByHash: make(map[string]*APIKey),
	}
}

func (m *MockRepository) Create(ctx context.Context, key *APIKey) error {
	m.keys[key.ID] = key
	m.keysByHash[key.KeyHash] = key
	return nil
}

func (m *MockRepository) GetByHash(ctx context.Context, keyHash string) (*APIKey, error) {
	if key, ok := m.keysByHash[keyHash]; ok {
		return key, nil
	}
	return nil, ErrKeyNotFound
}

func (m *MockRepository) GetByID(ctx context.Context, id string) (*APIKey, error) {
	if key, ok := m.keys[id]; ok {
		return key, nil
	}
	return nil, ErrKeyNotFound
}

func (m *MockRepository) ListByTenant(ctx context.Context, tenantID string) ([]*APIKey, error) {
	var result []*APIKey
	for _, key := range m.keys {
		if key.TenantID == tenantID {
			result = append(result, key)
		}
	}
	return result, nil
}

func (m *MockRepository) UpdateLastUsed(ctx context.Context, id string, timestamp time.Time) error {
	if key, ok := m.keys[id]; ok {
		key.LastUsedAt = &timestamp
	}
	return nil
}

func (m *MockRepository) Revoke(ctx context.Context, id string) error {
	if key, ok := m.keys[id]; ok {
		now := time.Now()
		key.RevokedAt = &now
	}
	return nil
}

func (m *MockRepository) Delete(ctx context.Context, id string) error {
	if key, ok := m.keys[id]; ok {
		delete(m.keysByHash, key.KeyHash)
	}
	delete(m.keys, id)
	return nil
}

func TestService_Create(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	result, err := service.Create(context.Background(), CreateKeyInput{
		TenantID:    "tenant-1",
		Name:        "Production Key",
		Permissions: []string{"read:products", "write:orders"},
	})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Check result
	if result.ID == "" {
		t.Error("expected ID to be set")
	}

	if result.APIKey == "" {
		t.Error("expected APIKey to be set")
	}

	if result.SecretKey == "" {
		t.Error("expected SecretKey to be set")
	}

	// Check key format
	if len(result.APIKey) < 20 {
		t.Error("API key too short")
	}

	if result.APIKey[:10] != "shop_live_" {
		t.Errorf("API key should start with shop_live_, got %s", result.APIKey[:10])
	}

	if result.SecretKey[:12] != "shop_secret_" {
		t.Errorf("Secret key should start with shop_secret_, got %s", result.SecretKey[:12])
	}

	// Check permissions
	if len(result.Permissions) != 2 {
		t.Errorf("expected 2 permissions, got %d", len(result.Permissions))
	}
}

func TestService_Validate(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Create a key
	result, _ := service.Create(context.Background(), CreateKeyInput{
		TenantID:    "tenant-1",
		Name:        "Test Key",
		Permissions: []string{"read:products"},
	})

	// Validate with correct keys
	key, err := service.Validate(context.Background(), result.APIKey, result.SecretKey)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if key.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", key.TenantID)
	}
}

func TestService_Validate_InvalidKey(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Validate with invalid keys
	_, err := service.Validate(context.Background(), "invalid", "invalid")
	if err != ErrKeyNotFound {
		t.Errorf("expected ErrKeyNotFound, got %v", err)
	}
}

func TestService_Validate_EmptyKeys(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	_, err := service.Validate(context.Background(), "", "secret")
	if err != ErrInvalidKey {
		t.Errorf("expected ErrInvalidKey, got %v", err)
	}

	_, err = service.Validate(context.Background(), "api", "")
	if err != ErrInvalidKey {
		t.Errorf("expected ErrInvalidKey, got %v", err)
	}
}

func TestService_Validate_RevokedKey(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Create and revoke a key
	result, _ := service.Create(context.Background(), CreateKeyInput{
		TenantID:    "tenant-1",
		Name:        "Revoked Key",
		Permissions: []string{"read:products"},
	})

	service.Revoke(context.Background(), result.ID)

	// Try to validate
	_, err := service.Validate(context.Background(), result.APIKey, result.SecretKey)
	if err != ErrKeyRevoked {
		t.Errorf("expected ErrKeyRevoked, got %v", err)
	}
}

func TestService_Validate_ExpiredKey(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Create an expired key
	expiredTime := time.Now().Add(-24 * time.Hour)
	result, _ := service.Create(context.Background(), CreateKeyInput{
		TenantID:    "tenant-1",
		Name:        "Expired Key",
		Permissions: []string{"read:products"},
		ExpiresAt:   &expiredTime,
	})

	// Try to validate
	_, err := service.Validate(context.Background(), result.APIKey, result.SecretKey)
	if err != ErrKeyRevoked {
		t.Errorf("expected ErrKeyRevoked for expired key, got %v", err)
	}
}

func TestService_HasPermission(t *testing.T) {
	service := &Service{}

	tests := []struct {
		name       string
		keyPerms   []string
		checkPerm  string
		wantResult bool
	}{
		{
			name:       "exact match",
			keyPerms:   []string{"read:products"},
			checkPerm:  "read:products",
			wantResult: true,
		},
		{
			name:       "no match",
			keyPerms:   []string{"read:products"},
			checkPerm:  "write:products",
			wantResult: false,
		},
		{
			name:       "admin has all permissions",
			keyPerms:   []string{"admin"},
			checkPerm:  "write:orders",
			wantResult: true,
		},
		{
			name:       "wildcard read",
			keyPerms:   []string{"read:*"},
			checkPerm:  "read:products",
			wantResult: true,
		},
		{
			name:       "wildcard doesn't match write",
			keyPerms:   []string{"read:*"},
			checkPerm:  "write:products",
			wantResult: false,
		},
		{
			name:       "multiple permissions",
			keyPerms:   []string{"read:products", "write:orders"},
			checkPerm:  "write:orders",
			wantResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := &APIKey{Permissions: tt.keyPerms}
			got := service.HasPermission(key, tt.checkPerm)
			if got != tt.wantResult {
				t.Errorf("HasPermission() = %v, want %v", got, tt.wantResult)
			}
		})
	}
}

func TestService_List(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	// Create keys for different tenants
	service.Create(context.Background(), CreateKeyInput{
		TenantID: "tenant-1",
		Name:     "Key 1",
	})
	service.Create(context.Background(), CreateKeyInput{
		TenantID: "tenant-1",
		Name:     "Key 2",
	})
	service.Create(context.Background(), CreateKeyInput{
		TenantID: "tenant-2",
		Name:     "Other Tenant Key",
	})

	// List for tenant-1
	keys, err := service.List(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(keys) != 2 {
		t.Errorf("expected 2 keys for tenant-1, got %d", len(keys))
	}
}

func TestService_Delete(t *testing.T) {
	repo := NewMockRepository()
	service := NewService(repo)

	result, _ := service.Create(context.Background(), CreateKeyInput{
		TenantID: "tenant-1",
		Name:     "To Delete",
	})

	err := service.Delete(context.Background(), result.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify key is gone
	_, err = service.Validate(context.Background(), result.APIKey, result.SecretKey)
	if err != ErrKeyNotFound {
		t.Errorf("expected ErrKeyNotFound after delete, got %v", err)
	}
}

func TestGenerateAPIKey(t *testing.T) {
	key1 := generateAPIKey()
	key2 := generateAPIKey()

	// Keys should be unique
	if key1 == key2 {
		t.Error("generated keys should be unique")
	}

	// Keys should have correct prefix
	if key1[:10] != "shop_live_" {
		t.Errorf("key should start with shop_live_, got %s", key1[:10])
	}

	// Keys should have correct length
	if len(key1) < 50 {
		t.Errorf("key should be at least 50 chars, got %d", len(key1))
	}
}

func TestGenerateSecretKey(t *testing.T) {
	key1 := generateSecretKey()
	key2 := generateSecretKey()

	// Keys should be unique
	if key1 == key2 {
		t.Error("generated secrets should be unique")
	}

	// Keys should have correct prefix
	if key1[:12] != "shop_secret_" {
		t.Errorf("secret should start with shop_secret_, got %s", key1[:12])
	}
}

func TestHashKey(t *testing.T) {
	hash1 := hashKey("test-key")
	hash2 := hashKey("test-key")
	hash3 := hashKey("different-key")

	// Same input should produce same hash
	if hash1 != hash2 {
		t.Error("same input should produce same hash")
	}

	// Different input should produce different hash
	if hash1 == hash3 {
		t.Error("different input should produce different hash")
	}

	// Hash should be 64 chars (SHA256 hex)
	if len(hash1) != 64 {
		t.Errorf("hash should be 64 chars, got %d", len(hash1))
	}
}

func TestIsValidPermission(t *testing.T) {
	valid := []string{
		"read:products",
		"write:products",
		"read:orders",
		"admin",
	}

	for _, p := range valid {
		if !IsValidPermission(p) {
			t.Errorf("expected %s to be valid", p)
		}
	}

	invalid := []string{
		"invalid",
		"read:invalid",
		"super:admin",
	}

	for _, p := range invalid {
		if IsValidPermission(p) {
			t.Errorf("expected %s to be invalid", p)
		}
	}
}
