# App Store & Developer Platform

## Overview

The App Store enables third-party developers to build integrations and plugins for the Shop Platform. It provides OAuth2 authentication, webhooks, and a marketplace for distributing apps.

## Features

- **OAuth2 with PKCE**: Secure authorization for apps
- **Webhook Events**: Real-time event notifications
- **App Marketplace**: Discovery and installation of apps
- **Developer Portal**: App management and analytics

## OAuth2 Flow

### 1. Authorization Request

Redirect users to the authorization endpoint:

```
GET /oauth/authorize?
  client_id={client_id}&
  redirect_uri={redirect_uri}&
  response_type=code&
  scope=read:products write:orders&
  state={random_state}&
  code_challenge={code_challenge}&
  code_challenge_method=S256
```

### 2. User Grants Permission

User sees the permission screen and approves the app.

### 3. Authorization Code

User is redirected back with an authorization code:

```
{redirect_uri}?code={authorization_code}&state={state}
```

### 4. Token Exchange

Exchange the code for access token:

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
client_id={client_id}&
client_secret={client_secret}&
code={authorization_code}&
redirect_uri={redirect_uri}&
code_verifier={code_verifier}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_a1b2c3d4e5f6...",
  "scope": "read:products write:orders"
}
```

### 5. Refresh Token

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
client_id={client_id}&
client_secret={client_secret}&
refresh_token={refresh_token}
```

## Available Scopes

| Scope | Description |
|-------|-------------|
| `read:products` | Read product catalog |
| `write:products` | Create/update products |
| `read:orders` | Read orders |
| `write:orders` | Create/update orders |
| `read:customers` | Read customer data |
| `write:customers` | Manage customers |
| `read:inventory` | Read inventory levels |
| `write:inventory` | Update inventory |
| `read:analytics` | Access analytics data |
| `webhooks` | Receive webhook events |
| `storefront` | Access storefront API |

## App Categories

- `shipping` - Shipping & fulfillment integrations
- `payment` - Payment gateways
- `marketing` - Marketing & advertising tools
- `analytics` - Analytics & reporting
- `inventory` - Inventory management
- `customer_service` - Support & CRM tools
- `accounting` - Accounting integrations
- `integration` - General integrations

## Registering an App

### Create App

```
POST /api/v1/apps
Authorization: Bearer {developer_token}
Content-Type: application/json

{
  "name": "Shipping Pro",
  "slug": "shipping-pro",
  "description": "Advanced shipping integration",
  "category": "shipping",
  "redirect_uris": [
    "https://myapp.com/callback",
    "https://myapp.com/oauth/callback"
  ],
  "scopes": ["read:orders", "write:orders", "webhooks"],
  "webhook_url": "https://myapp.com/webhooks",
  "support_email": "support@myapp.com",
  "privacy_url": "https://myapp.com/privacy",
  "icon": "https://myapp.com/icon.png"
}
```

Response:
```json
{
  "id": "app_abc123",
  "client_id": "ci_xyz789",
  "client_secret": "cs_secret_key_here",
  "status": "draft",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Submit for Review

```
POST /api/v1/apps/{app_id}/submit
Authorization: Bearer {developer_token}
```

### App Lifecycle

```
draft -> pending -> approved/rejected -> published -> suspended
```

## Webhooks

### Subscribing to Events

Configure webhook URL when registering the app, or update it:

```
PATCH /api/v1/apps/{app_id}
Authorization: Bearer {developer_token}
Content-Type: application/json

{
  "webhook_url": "https://myapp.com/webhooks",
  "webhook_events": ["order.created", "product.updated"]
}
```

### Available Events

| Event | Description |
|-------|-------------|
| `order.created` | New order placed |
| `order.updated` | Order status changed |
| `order.cancelled` | Order cancelled |
| `product.created` | New product added |
| `product.updated` | Product modified |
| `product.deleted` | Product removed |
| `customer.created` | New customer registered |
| `inventory.low` | Stock below threshold |
| `app.installed` | App installed by merchant |
| `app.uninstalled` | App uninstalled |

### Webhook Payload

```json
{
  "id": "evt_123456",
  "type": "order.created",
  "tenant_id": "tenant_abc",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {
    "order_id": "order_xyz",
    "total": 150.00,
    "currency": "USD",
    "items": [...]
  }
}
```

### Webhook Signature

Verify webhook authenticity using HMAC-SHA256:

```go
signature := r.Header.Get("X-Webhook-Signature")
timestamp := r.Header.Get("X-Webhook-Timestamp")

payload := timestamp + "." + body
expected := hmac.New(sha256.New, []byte(webhookSecret))
expected.Write([]byte(payload))

if !hmac.Equal(signature, hex.EncodeToString(expected.Sum(nil))) {
    // Invalid signature
}
```

### Retry Policy

Failed webhooks are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 12 hours |

## Installation Flow

### Install App

```
POST /api/v1/apps/{app_id}/install
Authorization: Bearer {merchant_token}
```

### Uninstall App

```
DELETE /api/v1/apps/{app_id}/install
Authorization: Bearer {merchant_token}
```

### List Installed Apps

```
GET /api/v1/apps/installed
Authorization: Bearer {merchant_token}
```

## Developer Portal API

### Get App Analytics

```
GET /api/v1/apps/{app_id}/analytics
Authorization: Bearer {developer_token}
```

Response:
```json
{
  "installations": 1250,
  "active_installations": 1100,
  "api_calls_today": 50000,
  "api_calls_month": 1500000,
  "average_rating": 4.5,
  "reviews_count": 85
}
```

### Get App Reviews

```
GET /api/v1/apps/{app_id}/reviews
Authorization: Bearer {developer_token}
```

## Pricing Models

Apps can use various pricing models:

| Model | Description |
|-------|-------------|
| `free` | Free to install |
| `one_time` | One-time purchase |
| `monthly` | Monthly subscription |
| `yearly` | Annual subscription |
| `usage` | Pay per API call |

```json
{
  "pricing": {
    "model": "monthly",
    "price": 29.99,
    "currency": "USD",
    "trial_days": 14
  }
}
```

## Rate Limits

Apps are subject to rate limits based on the merchant's plan:

| Plan | Requests/Hour |
|------|---------------|
| Free | 1,000 |
| Starter | 10,000 |
| Professional | 50,000 |
| Enterprise | Unlimited |

## Error Codes

| Code | Description |
|------|-------------|
| `invalid_client` | Unknown client_id |
| `invalid_grant` | Invalid or expired code/token |
| `invalid_scope` | Requested scope not allowed |
| `invalid_redirect_uri` | Redirect URI mismatch |
| `app_not_approved` | App not approved for marketplace |
| `installation_not_found` | App not installed |
