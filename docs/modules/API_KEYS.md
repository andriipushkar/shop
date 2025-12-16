# API Keys Management

Система управління API ключами для автентифікації зовнішніх клієнтів та інтеграцій.

## Overview

Модуль API Keys забезпечує:
- Генерація та ревокація API ключів
- Scoped permissions для різних операцій
- Rate limiting per key
- Аудит використання
- Підтримка мультитенантності

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    API KEY MANAGEMENT                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   External   │    │   API        │    │    Key Store     │  │
│  │   Client     │───▶│   Gateway    │───▶│                  │  │
│  │              │    │              │    │  - Validation    │  │
│  └──────────────┘    │  X-API-Key   │    │  - Permissions   │  │
│                      │  header      │    │  - Rate limits   │  │
│                      └──────────────┘    └──────────────────┘  │
│                                                                  │
│  Key Types:                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   Admin    │  │   Public   │  │   Service  │                │
│  │   (full)   │  │   (read)   │  │  (internal)│                │
│  └────────────┘  └────────────┘  └────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Types

| Type | Prefix | Permissions | Use Case |
|------|--------|-------------|----------|
| Admin | `sk_admin_` | Full access | Backend integrations |
| Public | `pk_pub_` | Read-only | Frontend, mobile apps |
| Service | `sk_svc_` | Service-to-service | Microservices |
| Webhook | `wh_` | Webhook delivery | Event delivery |

## Data Model

```go
type APIKey struct {
    ID          string    `json:"id"`
    TenantID    string    `json:"tenant_id"`
    Name        string    `json:"name"`
    Key         string    `json:"-"`              // Hashed, never returned
    KeyPrefix   string    `json:"key_prefix"`     // First 8 chars for identification
    Type        KeyType   `json:"type"`
    Scopes      []string  `json:"scopes"`
    RateLimit   int       `json:"rate_limit"`     // Requests per minute
    ExpiresAt   *time.Time `json:"expires_at"`
    LastUsedAt  *time.Time `json:"last_used_at"`
    CreatedAt   time.Time `json:"created_at"`
    CreatedBy   string    `json:"created_by"`
    IsActive    bool      `json:"is_active"`
    Metadata    map[string]string `json:"metadata"`
}
```

## Scopes

### Product Scopes
- `products:read` - Read products
- `products:write` - Create/update products
- `products:delete` - Delete products

### Order Scopes
- `orders:read` - Read orders
- `orders:write` - Create/update orders
- `orders:delete` - Cancel orders

### Customer Scopes
- `customers:read` - Read customers
- `customers:write` - Create/update customers

### Inventory Scopes
- `inventory:read` - Read stock
- `inventory:write` - Update stock

### Admin Scopes
- `admin:*` - Full admin access
- `webhooks:manage` - Manage webhooks
- `apikeys:manage` - Manage API keys

## Usage

### Create API Key

```go
key, secret, err := apikeys.Create(ctx, &apikeys.CreateKeyRequest{
    TenantID:  tenant.ID,
    Name:      "Mobile App Integration",
    Type:      apikeys.TypePublic,
    Scopes:    []string{"products:read", "orders:write"},
    RateLimit: 100,
    ExpiresAt: time.Now().AddDate(1, 0, 0), // 1 year
    CreatedBy: user.ID,
})

// IMPORTANT: secret is only returned once!
fmt.Printf("API Key: %s\n", secret)
// Output: pk_pub_a1b2c3d4e5f6g7h8i9j0...
```

### Validate API Key

```go
key, err := apikeys.Validate(ctx, apiKeyString)
if err != nil {
    if errors.Is(err, apikeys.ErrKeyNotFound) {
        return errors.New("invalid API key")
    }
    if errors.Is(err, apikeys.ErrKeyExpired) {
        return errors.New("API key expired")
    }
    if errors.Is(err, apikeys.ErrKeyRevoked) {
        return errors.New("API key revoked")
    }
    return err
}

// Check scopes
if !key.HasScope("products:write") {
    return errors.New("insufficient permissions")
}
```

### HTTP Middleware

```go
func APIKeyAuth(keyService *apikeys.Service) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            apiKey := r.Header.Get("X-API-Key")
            if apiKey == "" {
                apiKey = r.URL.Query().Get("api_key")
            }

            if apiKey == "" {
                http.Error(w, "API key required", http.StatusUnauthorized)
                return
            }

            key, err := keyService.Validate(r.Context(), apiKey)
            if err != nil {
                http.Error(w, "Invalid API key", http.StatusUnauthorized)
                return
            }

            // Add key to context
            ctx := context.WithValue(r.Context(), "api_key", key)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

### Revoke API Key

```go
err := apikeys.Revoke(ctx, keyID)
if err != nil {
    return err
}
// Key immediately invalidated
```

### Rotate API Key

```go
newKey, newSecret, err := apikeys.Rotate(ctx, keyID)
// Old key invalidated, new key created with same settings
```

## API Endpoints

```
POST   /api/v1/api-keys              # Create new key
GET    /api/v1/api-keys              # List all keys
GET    /api/v1/api-keys/:id          # Get key details
DELETE /api/v1/api-keys/:id          # Revoke key
POST   /api/v1/api-keys/:id/rotate   # Rotate key
GET    /api/v1/api-keys/:id/usage    # Usage statistics
```

### Create Key Request

```json
POST /api/v1/api-keys
{
  "name": "Mobile App",
  "type": "public",
  "scopes": ["products:read", "orders:write"],
  "rate_limit": 100,
  "expires_at": "2025-01-15T00:00:00Z",
  "metadata": {
    "app": "ios",
    "version": "2.0"
  }
}
```

### Response

```json
{
  "id": "key_abc123",
  "key": "pk_pub_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "name": "Mobile App",
  "type": "public",
  "key_prefix": "pk_pub_a",
  "scopes": ["products:read", "orders:write"],
  "rate_limit": 100,
  "expires_at": "2025-01-15T00:00:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

## Rate Limiting

```go
type RateLimitConfig struct {
    RequestsPerMinute int           // e.g., 100
    BurstSize         int           // e.g., 20
    Window            time.Duration // e.g., 1 minute
}

// Rate limit response headers
// X-RateLimit-Limit: 100
// X-RateLimit-Remaining: 95
// X-RateLimit-Reset: 1705312800
```

## Audit Logging

```go
type APIKeyUsage struct {
    KeyID       string    `json:"key_id"`
    Endpoint    string    `json:"endpoint"`
    Method      string    `json:"method"`
    StatusCode  int       `json:"status_code"`
    IP          string    `json:"ip"`
    UserAgent   string    `json:"user_agent"`
    Timestamp   time.Time `json:"timestamp"`
    ResponseMs  int       `json:"response_ms"`
}
```

## Security Best Practices

1. **Never log full keys** - Only log prefix (first 8 chars)
2. **Hash keys in DB** - Store bcrypt/argon2 hash
3. **Short expiration** - Rotate keys regularly
4. **Minimal scopes** - Grant only required permissions
5. **IP whitelisting** - Optional IP restrictions
6. **Secure transmission** - HTTPS only
7. **Key rotation** - Implement seamless rotation

## Admin UI

API Keys management at `/admin/settings/api-keys`:
- List all keys with usage stats
- Create new keys with scope selection
- View key details (without secret)
- Revoke/rotate keys
- Usage analytics

## Configuration

```bash
# API Keys settings
API_KEY_HASH_ALGORITHM=argon2id
API_KEY_DEFAULT_RATE_LIMIT=100
API_KEY_MAX_RATE_LIMIT=1000
API_KEY_DEFAULT_EXPIRY_DAYS=365

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORE=redis
```

## See Also

- [Authentication](./AUTH.md)
- [Security](./SECURITY.md)
- [Rate Limiting](../architecture/RATE_LIMITING.md)
- [API Gateway](../API_GATEWAY.md)
