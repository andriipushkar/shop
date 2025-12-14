# Security Module

Безпека, автентифікація та авторизація платформи.

## Огляд

| Компонент | Технологія |
|-----------|------------|
| Автентифікація | JWT + Refresh Tokens |
| OAuth2 | PKCE Flow |
| Password Hashing | Argon2id |
| Encryption | AES-256-GCM |
| RBAC | Role-Based Access Control |

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY MODULE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Authentication                         │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │   JWT    │  │  OAuth2  │  │   API    │  │  Admin  │ │   │
│  │  │  Tokens  │  │   PKCE   │  │   Keys   │  │  Login  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Authorization                          │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │   │
│  │  │  Roles   │  │ Permiss- │  │  Resource-Based      │  │   │
│  │  │          │  │  ions    │  │  Access Control      │  │   │
│  │  └──────────┘  └──────────┘  └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Protection                             │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │  Rate    │  │   CORS   │  │   CSRF   │  │   XSS   │ │   │
│  │  │ Limiting │  │          │  │          │  │  Filter │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Автентифікація

### JWT Tokens

```go
type TokenClaims struct {
    jwt.RegisteredClaims
    UserID    string   `json:"uid"`
    TenantID  string   `json:"tid"`
    Email     string   `json:"email"`
    Roles     []string `json:"roles"`
    TokenType string   `json:"type"` // access, refresh
}

type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int    `json:"expires_in"`
    TokenType    string `json:"token_type"`
}

func (s *AuthService) GenerateTokens(user *User) (*TokenPair, error) {
    // Access Token (15 хвилин)
    accessClaims := TokenClaims{
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   user.ID,
            Issuer:    "shop-platform",
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            ID:        uuid.New().String(),
        },
        UserID:    user.ID,
        TenantID:  user.TenantID,
        Email:     user.Email,
        Roles:     user.Roles,
        TokenType: "access",
    }

    accessToken := jwt.NewWithClaims(jwt.SigningMethodRS256, accessClaims)
    accessTokenString, _ := accessToken.SignedString(s.privateKey)

    // Refresh Token (7 днів)
    refreshClaims := TokenClaims{
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   user.ID,
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            ID:        uuid.New().String(),
        },
        UserID:    user.ID,
        TenantID:  user.TenantID,
        TokenType: "refresh",
    }

    refreshToken := jwt.NewWithClaims(jwt.SigningMethodRS256, refreshClaims)
    refreshTokenString, _ := refreshToken.SignedString(s.privateKey)

    // Зберігаємо refresh token в Redis
    s.redis.Set(ctx, "refresh:"+refreshClaims.ID, user.ID, 7*24*time.Hour)

    return &TokenPair{
        AccessToken:  accessTokenString,
        RefreshToken: refreshTokenString,
        ExpiresIn:    900, // 15 хвилин
        TokenType:    "Bearer",
    }, nil
}
```

### Password Hashing (Argon2id)

```go
type PasswordConfig struct {
    Memory      uint32 // 64 MB
    Iterations  uint32 // 3
    Parallelism uint8  // 4
    SaltLength  uint32 // 16
    KeyLength   uint32 // 32
}

var DefaultPasswordConfig = PasswordConfig{
    Memory:      64 * 1024,
    Iterations:  3,
    Parallelism: 4,
    SaltLength:  16,
    KeyLength:   32,
}

func HashPassword(password string) (string, error) {
    salt := make([]byte, DefaultPasswordConfig.SaltLength)
    rand.Read(salt)

    hash := argon2.IDKey(
        []byte(password),
        salt,
        DefaultPasswordConfig.Iterations,
        DefaultPasswordConfig.Memory,
        DefaultPasswordConfig.Parallelism,
        DefaultPasswordConfig.KeyLength,
    )

    // Формат: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
    return fmt.Sprintf(
        "$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version,
        DefaultPasswordConfig.Memory,
        DefaultPasswordConfig.Iterations,
        DefaultPasswordConfig.Parallelism,
        base64.RawStdEncoding.EncodeToString(salt),
        base64.RawStdEncoding.EncodeToString(hash),
    ), nil
}

func VerifyPassword(password, encodedHash string) bool {
    // Parse hash and compare
    // ...
}
```

### Login Flow

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 900,
  "token_type": "Bearer",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["admin"]
  }
}
```

### Refresh Token

```
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>

{
  "refresh_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

## OAuth2 (PKCE Flow)

### Для App Store Applications

```go
// Authorization Request
// GET /oauth/authorize?
//   response_type=code&
//   client_id=app_xxx&
//   redirect_uri=https://app.com/callback&
//   scope=read:products write:orders&
//   state=random_state&
//   code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
//   code_challenge_method=S256

type AuthorizationRequest struct {
    ResponseType        string `form:"response_type"` // code
    ClientID            string `form:"client_id"`
    RedirectURI         string `form:"redirect_uri"`
    Scope               string `form:"scope"`
    State               string `form:"state"`
    CodeChallenge       string `form:"code_challenge"`
    CodeChallengeMethod string `form:"code_challenge_method"` // S256
}

// Token Exchange
// POST /oauth/token
// Content-Type: application/x-www-form-urlencoded
//
// grant_type=authorization_code&
// code=AUTH_CODE&
// redirect_uri=https://app.com/callback&
// client_id=app_xxx&
// code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

type TokenRequest struct {
    GrantType    string `form:"grant_type"`
    Code         string `form:"code"`
    RedirectURI  string `form:"redirect_uri"`
    ClientID     string `form:"client_id"`
    CodeVerifier string `form:"code_verifier"`
}
```

### PKCE Implementation

```go
func generateCodeChallenge(verifier string) string {
    hash := sha256.Sum256([]byte(verifier))
    return base64.RawURLEncoding.EncodeToString(hash[:])
}

func verifyPKCE(codeChallenge, codeVerifier, method string) bool {
    if method != "S256" {
        return false
    }

    expected := generateCodeChallenge(codeVerifier)
    return subtle.ConstantTimeCompare([]byte(codeChallenge), []byte(expected)) == 1
}
```

## API Keys

### Для сервісної автентифікації

```go
type APIKey struct {
    ID          string    `json:"id"`
    TenantID    string    `json:"tenant_id"`
    Name        string    `json:"name"`
    KeyHash     string    `json:"-"`
    Prefix      string    `json:"prefix"` // sk_live_xxxx
    Permissions []string  `json:"permissions"`
    LastUsedAt  time.Time `json:"last_used_at,omitempty"`
    ExpiresAt   time.Time `json:"expires_at,omitempty"`
    CreatedAt   time.Time `json:"created_at"`
}

func GenerateAPIKey() (key string, hash string) {
    // Генеруємо 32 байти
    bytes := make([]byte, 32)
    rand.Read(bytes)

    // Формат: sk_live_<base62>
    key = "sk_live_" + base62.Encode(bytes)

    // Хешуємо для зберігання
    hashBytes := sha256.Sum256([]byte(key))
    hash = hex.EncodeToString(hashBytes[:])

    return key, hash
}
```

### Використання

```http
GET /api/v1/products
Authorization: Bearer sk_live_abc123xyz...
```

## RBAC (Role-Based Access Control)

### Ролі

| Роль | Опис |
|------|------|
| `super_admin` | Повний доступ до всього |
| `admin` | Адмін магазину |
| `manager` | Менеджер (замовлення, клієнти) |
| `warehouse` | Складські операції |
| `support` | Підтримка клієнтів |
| `viewer` | Тільки перегляд |

### Permissions

```go
var Permissions = map[string][]string{
    "super_admin": {"*"},

    "admin": {
        "products:*",
        "orders:*",
        "customers:*",
        "reports:*",
        "settings:read",
        "settings:write",
        "users:read",
        "users:write",
    },

    "manager": {
        "products:read",
        "orders:*",
        "customers:*",
        "reports:read",
    },

    "warehouse": {
        "products:read",
        "inventory:*",
        "orders:read",
        "orders:ship",
    },

    "support": {
        "orders:read",
        "customers:read",
        "customers:write",
    },

    "viewer": {
        "products:read",
        "orders:read",
        "customers:read",
        "reports:read",
    },
}
```

### Permission Check

```go
func (s *AuthService) HasPermission(user *User, permission string) bool {
    for _, role := range user.Roles {
        perms := Permissions[role]
        for _, p := range perms {
            if p == "*" || p == permission {
                return true
            }
            // Wildcard matching: "orders:*" matches "orders:read"
            if strings.HasSuffix(p, ":*") {
                prefix := strings.TrimSuffix(p, "*")
                if strings.HasPrefix(permission, prefix) {
                    return true
                }
            }
        }
    }
    return false
}

// Middleware
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := GetUserFromContext(c)
        if !authService.HasPermission(user, permission) {
            c.AbortWithStatusJSON(403, gin.H{
                "error": "Forbidden",
                "message": "You don't have permission to perform this action",
            })
            return
        }
        c.Next()
    }
}
```

## Multi-Tenancy Security

### Tenant Isolation

```go
// Middleware для ізоляції даних
func TenantIsolation() gin.HandlerFunc {
    return func(c *gin.Context) {
        user := GetUserFromContext(c)

        // Додаємо tenant_id до контексту
        ctx := context.WithValue(c.Request.Context(), "tenant_id", user.TenantID)
        c.Request = c.Request.WithContext(ctx)

        c.Next()
    }
}

// Repository автоматично фільтрує по tenant
func (r *ProductRepository) FindByID(ctx context.Context, id string) (*Product, error) {
    tenantID := ctx.Value("tenant_id").(string)

    var product Product
    err := r.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&product).Error
    return &product, err
}
```

### Cross-Tenant Protection

```go
// Перевірка належності ресурсу до тенанта
func (s *OrderService) GetOrder(ctx context.Context, orderID string) (*Order, error) {
    tenantID := ctx.Value("tenant_id").(string)

    order, err := s.repo.FindByID(ctx, orderID)
    if err != nil {
        return nil, err
    }

    // Перевірка tenant
    if order.TenantID != tenantID {
        return nil, ErrForbidden
    }

    return order, nil
}
```

## Rate Limiting

### Per-IP Rate Limiting

```go
type RateLimiter struct {
    redis   *redis.Client
    limit   int           // requests
    window  time.Duration // per window
}

func (r *RateLimiter) Allow(key string) (bool, error) {
    ctx := context.Background()
    now := time.Now().Unix()
    windowKey := fmt.Sprintf("ratelimit:%s:%d", key, now/int64(r.window.Seconds()))

    count, err := r.redis.Incr(ctx, windowKey).Result()
    if err != nil {
        return false, err
    }

    if count == 1 {
        r.redis.Expire(ctx, windowKey, r.window)
    }

    return count <= int64(r.limit), nil
}

// Middleware
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()

        allowed, err := limiter.Allow(ip)
        if err != nil || !allowed {
            c.AbortWithStatusJSON(429, gin.H{
                "error": "Too Many Requests",
                "retry_after": 60,
            })
            return
        }

        c.Next()
    }
}
```

### Per-User Rate Limiting

```go
var UserRateLimits = map[string]RateLimit{
    "api":     {Limit: 1000, Window: time.Minute},
    "login":   {Limit: 5, Window: time.Minute},
    "signup":  {Limit: 3, Window: time.Hour},
    "webhook": {Limit: 100, Window: time.Second},
}
```

## CORS Configuration

```go
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
    return cors.New(cors.Config{
        AllowOrigins:     allowedOrigins,
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Tenant-ID"},
        ExposeHeaders:    []string{"Content-Length", "X-Request-ID"},
        AllowCredentials: true,
        MaxAge:           12 * time.Hour,
    })
}
```

## CSRF Protection

```go
type CSRFConfig struct {
    Secret      string
    CookieName  string
    HeaderName  string
    CookiePath  string
    Secure      bool
    SameSite    http.SameSite
}

func CSRFMiddleware(config CSRFConfig) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Skip safe methods
        if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
            c.Next()
            return
        }

        // Get token from cookie
        cookieToken, err := c.Cookie(config.CookieName)
        if err != nil {
            c.AbortWithStatusJSON(403, gin.H{"error": "CSRF cookie missing"})
            return
        }

        // Get token from header
        headerToken := c.GetHeader(config.HeaderName)
        if headerToken == "" {
            c.AbortWithStatusJSON(403, gin.H{"error": "CSRF header missing"})
            return
        }

        // Verify tokens match
        if !verifyCSRFToken(cookieToken, headerToken, config.Secret) {
            c.AbortWithStatusJSON(403, gin.H{"error": "CSRF token invalid"})
            return
        }

        c.Next()
    }
}
```

## XSS Protection

```go
// Sanitize user input
import "github.com/microcosm-cc/bluemonday"

var policy = bluemonday.UGCPolicy()

func SanitizeHTML(input string) string {
    return policy.Sanitize(input)
}

// Security headers
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        c.Header("Content-Security-Policy", "default-src 'self'")
        c.Next()
    }
}
```

## Encryption

### Data Encryption (AES-256-GCM)

```go
type Encryptor struct {
    key []byte // 32 bytes for AES-256
}

func (e *Encryptor) Encrypt(plaintext []byte) ([]byte, error) {
    block, _ := aes.NewCipher(e.key)
    gcm, _ := cipher.NewGCM(block)

    nonce := make([]byte, gcm.NonceSize())
    rand.Read(nonce)

    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
    return ciphertext, nil
}

func (e *Encryptor) Decrypt(ciphertext []byte) ([]byte, error) {
    block, _ := aes.NewCipher(e.key)
    gcm, _ := cipher.NewGCM(block)

    nonceSize := gcm.NonceSize()
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

    return gcm.Open(nil, nonce, ciphertext, nil)
}
```

### Field-Level Encryption

```go
// Шифрування чутливих полів
type Customer struct {
    ID            string `json:"id"`
    Email         string `json:"email"`
    Phone         string `json:"phone"`
    CreditCardEnc []byte `json:"-"` // Encrypted
}

func (c *Customer) SetCreditCard(cc string) {
    c.CreditCardEnc, _ = encryptor.Encrypt([]byte(cc))
}

func (c *Customer) GetCreditCard() string {
    decrypted, _ := encryptor.Decrypt(c.CreditCardEnc)
    return string(decrypted)
}
```

## Audit Logging

```go
type AuditLog struct {
    ID         string         `json:"id"`
    TenantID   string         `json:"tenant_id"`
    UserID     string         `json:"user_id"`
    Action     string         `json:"action"`
    Resource   string         `json:"resource"`
    ResourceID string         `json:"resource_id"`
    Changes    map[string]any `json:"changes,omitempty"`
    IP         string         `json:"ip"`
    UserAgent  string         `json:"user_agent"`
    CreatedAt  time.Time      `json:"created_at"`
}

func AuditMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Skip safe methods
        if c.Request.Method == "GET" {
            c.Next()
            return
        }

        c.Next()

        // Log after request
        user := GetUserFromContext(c)
        auditLog := AuditLog{
            ID:        uuid.New().String(),
            TenantID:  user.TenantID,
            UserID:    user.ID,
            Action:    c.Request.Method,
            Resource:  c.FullPath(),
            IP:        c.ClientIP(),
            UserAgent: c.GetHeader("User-Agent"),
            CreatedAt: time.Now(),
        }

        auditService.Log(auditLog)
    }
}
```

## Конфігурація

```bash
# JWT
JWT_PRIVATE_KEY_PATH=/path/to/private.pem
JWT_PUBLIC_KEY_PATH=/path/to/public.pem
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=168h

# Password
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_NUMBER=true
PASSWORD_REQUIRE_SPECIAL=true

# Rate Limiting
RATE_LIMIT_API=1000
RATE_LIMIT_LOGIN=5
RATE_LIMIT_WINDOW=60s

# CORS
CORS_ALLOWED_ORIGINS=https://admin.yourstore.com,https://yourstore.com
CORS_MAX_AGE=43200

# Encryption
ENCRYPTION_KEY=base64_encoded_32_byte_key

# Session
SESSION_SECRET=random_secret
SESSION_MAX_AGE=86400

# Security Headers
HSTS_MAX_AGE=31536000
CSP_POLICY=default-src 'self'
```
