# Error Codes

Стандартизовані коди помилок API.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ERROR RESPONSE FORMAT                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  {                                                                          │
│    "error": {                                                               │
│      "code": "VALIDATION_ERROR",                                            │
│      "message": "Validation failed",                                        │
│      "details": [                                                           │
│        {                                                                    │
│          "field": "email",                                                  │
│          "code": "INVALID_FORMAT",                                          │
│          "message": "Invalid email format"                                  │
│        }                                                                    │
│      ],                                                                     │
│      "request_id": "req_abc123"                                             │
│    }                                                                        │
│  }                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 204 | No Content | Success, no body |
| 400 | Bad Request | Invalid request |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Upstream error |
| 503 | Service Unavailable | Service down |

## Error Categories

### Authentication Errors (AUTH_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required | No token provided |
| `AUTH_INVALID_TOKEN` | 401 | Invalid token | Token is malformed or expired |
| `AUTH_TOKEN_EXPIRED` | 401 | Token expired | Access token has expired |
| `AUTH_REFRESH_REQUIRED` | 401 | Refresh token required | Need to refresh session |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid credentials | Wrong email/password |
| `AUTH_ACCOUNT_LOCKED` | 403 | Account locked | Too many failed attempts |
| `AUTH_ACCOUNT_DISABLED` | 403 | Account disabled | Account has been disabled |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Email not verified | Must verify email first |

```json
// Example
{
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "The provided access token is invalid or has expired",
    "request_id": "req_abc123"
  }
}
```

### Authorization Errors (AUTHZ_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `AUTHZ_FORBIDDEN` | 403 | Access denied | No permission for action |
| `AUTHZ_INSUFFICIENT_ROLE` | 403 | Insufficient role | Higher role required |
| `AUTHZ_RESOURCE_FORBIDDEN` | 403 | Resource access denied | Can't access this resource |
| `AUTHZ_TENANT_MISMATCH` | 403 | Tenant mismatch | Cross-tenant access attempt |

### Validation Errors (VALIDATION_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `VALIDATION_ERROR` | 422 | Validation failed | One or more fields invalid |
| `VALIDATION_REQUIRED` | 422 | Field required | Required field missing |
| `VALIDATION_INVALID_FORMAT` | 422 | Invalid format | Field format is wrong |
| `VALIDATION_MIN_LENGTH` | 422 | Too short | Below minimum length |
| `VALIDATION_MAX_LENGTH` | 422 | Too long | Exceeds maximum length |
| `VALIDATION_MIN_VALUE` | 422 | Value too small | Below minimum value |
| `VALIDATION_MAX_VALUE` | 422 | Value too large | Exceeds maximum value |
| `VALIDATION_INVALID_EMAIL` | 422 | Invalid email | Email format invalid |
| `VALIDATION_INVALID_PHONE` | 422 | Invalid phone | Phone format invalid |

```json
// Example with details
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for 2 fields",
    "details": [
      {
        "field": "email",
        "code": "VALIDATION_INVALID_EMAIL",
        "message": "Invalid email format"
      },
      {
        "field": "phone",
        "code": "VALIDATION_INVALID_PHONE",
        "message": "Phone must be in format +380XXXXXXXXX"
      }
    ],
    "request_id": "req_xyz789"
  }
}
```

### Resource Errors (RESOURCE_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `RESOURCE_NOT_FOUND` | 404 | Resource not found | Item doesn't exist |
| `RESOURCE_ALREADY_EXISTS` | 409 | Resource exists | Duplicate creation attempt |
| `RESOURCE_CONFLICT` | 409 | Resource conflict | Concurrent modification |
| `RESOURCE_DELETED` | 410 | Resource deleted | Item was deleted |
| `RESOURCE_LOCKED` | 423 | Resource locked | Being edited by another |

```json
// Example
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Product not found",
    "details": {
      "resource_type": "product",
      "resource_id": "prod_12345"
    },
    "request_id": "req_def456"
  }
}
```

### Business Logic Errors (BIZ_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `BIZ_INSUFFICIENT_STOCK` | 400 | Insufficient stock | Not enough inventory |
| `BIZ_INVALID_PROMO_CODE` | 400 | Invalid promo code | Promo code doesn't exist |
| `BIZ_PROMO_CODE_EXPIRED` | 400 | Promo code expired | Promo has ended |
| `BIZ_PROMO_CODE_USED` | 400 | Promo code already used | Single-use code |
| `BIZ_MIN_ORDER_AMOUNT` | 400 | Below minimum | Order total too low |
| `BIZ_MAX_ORDER_AMOUNT` | 400 | Exceeds maximum | Order total too high |
| `BIZ_CART_EMPTY` | 400 | Cart is empty | No items in cart |
| `BIZ_ORDER_CANCELLED` | 400 | Order cancelled | Order was cancelled |
| `BIZ_PAYMENT_FAILED` | 400 | Payment failed | Payment processing error |
| `BIZ_DELIVERY_UNAVAILABLE` | 400 | Delivery unavailable | Can't deliver to address |

```json
// Example
{
  "error": {
    "code": "BIZ_INSUFFICIENT_STOCK",
    "message": "Insufficient stock for product",
    "details": {
      "product_id": "prod_12345",
      "product_name": "iPhone 15 Pro",
      "requested_quantity": 5,
      "available_quantity": 2
    },
    "request_id": "req_ghi789"
  }
}
```

### Payment Errors (PAYMENT_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `PAYMENT_FAILED` | 400 | Payment failed | Generic payment failure |
| `PAYMENT_DECLINED` | 400 | Payment declined | Card declined |
| `PAYMENT_INSUFFICIENT_FUNDS` | 400 | Insufficient funds | Not enough balance |
| `PAYMENT_INVALID_CARD` | 400 | Invalid card | Card number invalid |
| `PAYMENT_EXPIRED_CARD` | 400 | Card expired | Card has expired |
| `PAYMENT_3DS_REQUIRED` | 400 | 3DS required | 3D Secure needed |
| `PAYMENT_PROVIDER_ERROR` | 502 | Provider error | Payment gateway down |

### Rate Limiting Errors (RATE_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded | Too many requests |
| `RATE_DAILY_LIMIT` | 429 | Daily limit reached | Daily quota exhausted |

```json
// Example
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": {
      "limit": 100,
      "window": "1 minute",
      "retry_after": 45
    },
    "request_id": "req_jkl012"
  }
}
```

### Server Errors (SERVER_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `SERVER_ERROR` | 500 | Internal error | Unexpected server error |
| `SERVER_DATABASE_ERROR` | 500 | Database error | DB operation failed |
| `SERVER_CACHE_ERROR` | 500 | Cache error | Cache operation failed |
| `SERVER_TIMEOUT` | 504 | Request timeout | Operation timed out |
| `SERVER_UNAVAILABLE` | 503 | Service unavailable | Service is down |

### Integration Errors (INT_*)

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `INT_NOVA_POSHTA_ERROR` | 502 | Nova Poshta error | Delivery API error |
| `INT_LIQPAY_ERROR` | 502 | LiqPay error | Payment API error |
| `INT_MONOBANK_ERROR` | 502 | Monobank error | Bank API error |
| `INT_CHECKBOX_ERROR` | 502 | Checkbox error | Fiscalization error |

## Error Handling Examples

### Go Backend

```go
// internal/errors/errors.go
package errors

type AppError struct {
    Code      string                 `json:"code"`
    Message   string                 `json:"message"`
    Details   interface{}            `json:"details,omitempty"`
    RequestID string                 `json:"request_id,omitempty"`
    HTTPCode  int                    `json:"-"`
}

func (e *AppError) Error() string {
    return e.Message
}

// Common errors
var (
    ErrNotFound = &AppError{
        Code:     "RESOURCE_NOT_FOUND",
        Message:  "Resource not found",
        HTTPCode: 404,
    }

    ErrUnauthorized = &AppError{
        Code:     "AUTH_REQUIRED",
        Message:  "Authentication required",
        HTTPCode: 401,
    }

    ErrValidation = &AppError{
        Code:     "VALIDATION_ERROR",
        Message:  "Validation failed",
        HTTPCode: 422,
    }
)

// Usage
func GetProduct(id string) (*Product, error) {
    product, err := repo.FindByID(id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, &AppError{
                Code:    "RESOURCE_NOT_FOUND",
                Message: "Product not found",
                Details: map[string]string{
                    "resource_type": "product",
                    "resource_id":   id,
                },
                HTTPCode: 404,
            }
        }
        return nil, err
    }
    return product, nil
}
```

### TypeScript Frontend

```typescript
// lib/errors.ts
export class APIError extends Error {
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(response: ErrorResponse) {
    super(response.error.message);
    this.code = response.error.code;
    this.details = response.error.details;
    this.requestId = response.error.request_id;
  }

  get isAuthError(): boolean {
    return this.code.startsWith('AUTH_');
  }

  get isValidationError(): boolean {
    return this.code.startsWith('VALIDATION_');
  }

  get isNotFound(): boolean {
    return this.code === 'RESOURCE_NOT_FOUND';
  }
}

// Usage
try {
  const product = await api.products.get(id);
} catch (error) {
  if (error instanceof APIError) {
    if (error.isNotFound) {
      redirect('/404');
    } else if (error.isAuthError) {
      redirect('/login');
    } else if (error.isValidationError) {
      showValidationErrors(error.details);
    }
  }
  throw error;
}
```

## See Also

- [API Reference](./README.md)
- [Rate Limits](./RATE_LIMITS.md)
- [Authentication](../modules/AUTH.md)
