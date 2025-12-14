# Authentication API Reference

API для автентифікації та авторизації.

## Огляд

| Метод | Опис |
|-------|------|
| JWT Tokens | Для користувачів та адмінів |
| API Keys | Для сервісної інтеграції |
| OAuth2 PKCE | Для сторонніх додатків |

## User Authentication

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "first_name": "Іван",
  "last_name": "Петренко",
  "phone": "+380991234567",
  "accept_terms": true
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "first_name": "Іван",
      "last_name": "Петренко",
      "phone": "+380991234567",
      "email_verified": false,
      "created_at": "2024-01-15T10:00:00Z"
    },
    "message": "Verification email sent"
  }
}
```

### Verify Email

```http
POST /api/v1/auth/verify-email
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "verification_token_from_email"
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "first_name": "Іван",
      "last_name": "Петренко",
      "roles": ["customer"]
    }
  }
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `204 No Content`

### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "first_name": "Іван",
    "last_name": "Петренко",
    "phone": "+380991234567",
    "email_verified": true,
    "phone_verified": true,
    "roles": ["customer"],
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

### Update Profile

```http
PATCH /api/v1/auth/me
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "first_name": "Іван",
  "last_name": "Петренко",
  "phone": "+380991234567"
}
```

### Change Password

```http
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "current_password": "OldP@ss123",
  "new_password": "NewSecureP@ss456"
}
```

---

## Password Reset

### Request Reset

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "data": {
    "message": "If email exists, reset instructions will be sent"
  }
}
```

### Reset Password

```http
POST /api/v1/auth/reset-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "password": "NewSecureP@ss456"
}
```

---

## Phone Verification

### Request OTP

```http
POST /api/v1/auth/phone/request-otp
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "phone": "+380991234567"
}
```

**Response:**

```json
{
  "data": {
    "message": "OTP sent to phone",
    "expires_in": 300
  }
}
```

### Verify OTP

```http
POST /api/v1/auth/phone/verify-otp
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "phone": "+380991234567",
  "code": "123456"
}
```

---

## Admin Authentication

### Admin Login

```http
POST /api/v1/admin/auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "admin@yourstore.com",
  "password": "AdminP@ss123",
  "two_factor_code": "123456"
}
```

**Response:**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "admin_xyz789",
      "email": "admin@yourstore.com",
      "name": "Admin User",
      "roles": ["admin"],
      "permissions": ["products:*", "orders:*", "customers:read"]
    }
  }
}
```

### Setup 2FA

```http
POST /api/v1/admin/auth/2fa/setup
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qr_code": "data:image/png;base64,iVBORw0KGgo...",
    "backup_codes": [
      "abc123def456",
      "ghi789jkl012"
    ]
  }
}
```

### Verify 2FA Setup

```http
POST /api/v1/admin/auth/2fa/verify
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "code": "123456"
}
```

---

## API Keys

### List API Keys

```http
GET /api/v1/api-keys
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "data": [
    {
      "id": "key_abc123",
      "name": "Production API Key",
      "prefix": "sk_live_abc1",
      "permissions": ["products:read", "orders:read"],
      "last_used_at": "2024-01-15T12:00:00Z",
      "expires_at": null,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create API Key

```http
POST /api/v1/api-keys
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Integration API Key",
  "permissions": ["products:read", "orders:*"],
  "expires_at": "2025-01-01T00:00:00Z"
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "key_xyz789",
    "name": "Integration API Key",
    "key": "sk_live_abc123xyz789...",
    "permissions": ["products:read", "orders:*"],
    "expires_at": "2025-01-01T00:00:00Z",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

> **Important:** The full API key is only shown once. Store it securely.

### Revoke API Key

```http
DELETE /api/v1/api-keys/{id}
Authorization: Bearer <admin_token>
```

---

## OAuth2 (PKCE Flow)

### Authorization Request

```http
GET /oauth/authorize
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `response_type` | Yes | Must be `code` |
| `client_id` | Yes | Application client ID |
| `redirect_uri` | Yes | Registered redirect URI |
| `scope` | Yes | Space-separated scopes |
| `state` | Yes | Random string for CSRF |
| `code_challenge` | Yes | PKCE code challenge |
| `code_challenge_method` | Yes | Must be `S256` |

**Example:**

```
GET /oauth/authorize?
  response_type=code&
  client_id=app_abc123&
  redirect_uri=https://myapp.com/callback&
  scope=read:products write:orders&
  state=xyz123&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256
```

### Token Exchange

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**

```
grant_type=authorization_code&
code=AUTH_CODE_FROM_REDIRECT&
redirect_uri=https://myapp.com/callback&
client_id=app_abc123&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "read:products write:orders"
}
```

### Refresh Access Token

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**

```
grant_type=refresh_token&
refresh_token=eyJhbGciOiJSUzI1NiIs...&
client_id=app_abc123
```

### Revoke Token

```http
POST /oauth/revoke
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**

```
token=eyJhbGciOiJSUzI1NiIs...&
client_id=app_abc123
```

---

## JWT Token Structure

### Access Token Claims

```json
{
  "iss": "shop-platform",
  "sub": "user_abc123",
  "aud": "shop-api",
  "exp": 1704096900,
  "iat": 1704096000,
  "jti": "token_unique_id",
  "uid": "user_abc123",
  "tid": "tenant_xyz",
  "email": "user@example.com",
  "roles": ["customer"],
  "type": "access"
}
```

### Refresh Token Claims

```json
{
  "iss": "shop-platform",
  "sub": "user_abc123",
  "exp": 1704700800,
  "iat": 1704096000,
  "jti": "refresh_unique_id",
  "uid": "user_abc123",
  "tid": "tenant_xyz",
  "type": "refresh"
}
```

---

## Scopes (OAuth2)

| Scope | Description |
|-------|-------------|
| `read:profile` | Read user profile |
| `write:profile` | Update user profile |
| `read:products` | Read products |
| `write:products` | Create/update products |
| `read:orders` | Read orders |
| `write:orders` | Create orders |
| `read:customers` | Read customers |
| `write:customers` | Update customers |

---

## Permissions (API Keys)

| Permission | Description |
|------------|-------------|
| `products:read` | Read products |
| `products:write` | Create/update products |
| `products:delete` | Delete products |
| `products:*` | All product operations |
| `orders:read` | Read orders |
| `orders:write` | Update orders |
| `orders:*` | All order operations |
| `customers:read` | Read customers |
| `customers:write` | Update customers |
| `inventory:read` | Read inventory |
| `inventory:write` | Update inventory |
| `webhooks:*` | Manage webhooks |

---

## Error Responses

### Invalid Credentials

```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "Invalid email or password"
  }
}
```

### Token Expired

```json
{
  "error": {
    "code": "token_expired",
    "message": "Access token has expired"
  }
}
```

### Invalid Token

```json
{
  "error": {
    "code": "invalid_token",
    "message": "Token is invalid or malformed"
  }
}
```

### Email Not Verified

```json
{
  "error": {
    "code": "email_not_verified",
    "message": "Please verify your email address"
  }
}
```

### 2FA Required

```json
{
  "error": {
    "code": "2fa_required",
    "message": "Two-factor authentication required",
    "details": {
      "method": "totp"
    }
  }
}
```

### Account Locked

```json
{
  "error": {
    "code": "account_locked",
    "message": "Account is temporarily locked due to multiple failed attempts",
    "details": {
      "unlock_at": "2024-01-15T11:00:00Z"
    }
  }
}
```

### Insufficient Permissions

```json
{
  "error": {
    "code": "forbidden",
    "message": "You don't have permission to perform this action",
    "details": {
      "required": "orders:write",
      "available": ["orders:read"]
    }
  }
}
```

---

## Security Best Practices

1. **Store tokens securely**
   - Use httpOnly cookies or secure storage
   - Never store in localStorage for sensitive apps

2. **Token rotation**
   - Refresh tokens before expiry
   - Revoke on logout

3. **API Key security**
   - Use environment variables
   - Rotate regularly
   - Use minimal permissions

4. **PKCE for mobile/SPA**
   - Always use PKCE for public clients
   - Generate cryptographically secure verifier

5. **Rate limiting**
   - Auth endpoints: 10 req/min
   - Token refresh: 60 req/hour
