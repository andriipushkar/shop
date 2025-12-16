# ADR-008: Стратегія версіонування API

## Статус

Прийнято

## Контекст

Shop Platform надає публічний API для інтеграцій. Необхідно визначити стратегію версіонування, яка:
- Забезпечує backward compatibility
- Дозволяє еволюцію API
- Мінімізує breaking changes
- Підтримує deprecation period
- Зрозуміла для клієнтів

### Розглянуті альтернативи

1. **URL Path Versioning**: `/v1/products`, `/v2/products`
   - Pros: Явний, простий для розуміння
   - Cons: Дублювання routes, потенційно багато версій

2. **Query Parameter**: `/products?version=1`
   - Pros: Гнучкий
   - Cons: Легко пропустити, кешування проблеми

3. **Header Versioning**: `Accept: application/vnd.shop.v1+json`
   - Pros: Чистий URL, REST-compliant
   - Cons: Менш очевидний, складніше тестувати

4. **Date-based Versioning**: `Stripe-Version: 2024-01-15`
   - Pros: Granular control, automatic deprecation
   - Cons: Складніше управляти

## Рішення

Використовуємо **URL Path Versioning** з **Semantic Versioning** для major versions.

### Формат

```
/api/v{major}/resource
```

Приклади:
- `/api/v1/products`
- `/api/v1/orders`
- `/api/v2/products` (коли буде breaking change)

### Semantic Versioning

- **Major (v1 → v2)**: Breaking changes, нова версія в URL
- **Minor**: Нові features, backward compatible, в headers
- **Patch**: Bug fixes, backward compatible

## Імплементація

### Router структура

```go
// cmd/server/main.go
package main

import (
	"github.com/gin-gonic/gin"
	v1 "shop-platform/internal/api/v1"
	v2 "shop-platform/internal/api/v2"
)

func main() {
	r := gin.Default()

	// API Version 1
	apiV1 := r.Group("/api/v1")
	{
		v1.RegisterRoutes(apiV1)
	}

	// API Version 2 (when needed)
	apiV2 := r.Group("/api/v2")
	{
		v2.RegisterRoutes(apiV2)
	}

	r.Run(":8080")
}
```

### Version Header

```go
// internal/middleware/version.go
package middleware

import (
	"github.com/gin-gonic/gin"
)

const (
	CurrentAPIVersion = "1.4.0"
	MinAPIVersion     = "1.0.0"
)

func APIVersion() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Set version headers
		c.Header("X-API-Version", CurrentAPIVersion)
		c.Header("X-Min-API-Version", MinAPIVersion)

		// Check client version if provided
		clientVersion := c.GetHeader("X-Client-Version")
		if clientVersion != "" {
			// Log client version for analytics
			// Could also validate compatibility
		}

		c.Next()
	}
}
```

### Deprecation Headers

```go
// internal/middleware/deprecation.go
package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

type DeprecationInfo struct {
	Deprecated    bool
	SunsetDate    time.Time
	Replacement   string
	Documentation string
}

var deprecatedEndpoints = map[string]DeprecationInfo{
	"GET /api/v1/products/search": {
		Deprecated:    true,
		SunsetDate:    time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC),
		Replacement:   "GET /api/v1/search/products",
		Documentation: "https://docs.shop-platform.com/migration/search",
	},
}

func DeprecationWarning() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := fmt.Sprintf("%s %s", c.Request.Method, c.FullPath())

		if info, ok := deprecatedEndpoints[key]; ok && info.Deprecated {
			c.Header("Deprecation", info.SunsetDate.Format(time.RFC1123))
			c.Header("Sunset", info.SunsetDate.Format(time.RFC1123))

			if info.Replacement != "" {
				c.Header("Link", fmt.Sprintf("<%s>; rel=\"successor-version\"", info.Replacement))
			}

			// Add warning header
			c.Header("Warning", fmt.Sprintf(
				"299 - \"This endpoint is deprecated and will be removed on %s. %s\"",
				info.SunsetDate.Format("2006-01-02"),
				info.Documentation,
			))
		}

		c.Next()
	}
}
```

### Response Wrapper

```go
// internal/api/response.go
package api

import (
	"github.com/gin-gonic/gin"
)

type APIResponse struct {
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

type Meta struct {
	Version     string      `json:"version"`
	RequestID   string      `json:"request_id"`
	Pagination  *Pagination `json:"pagination,omitempty"`
	Deprecation *string     `json:"deprecation,omitempty"`
}

type APIError struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

func Success(c *gin.Context, data interface{}, meta *Meta) {
	if meta == nil {
		meta = &Meta{}
	}
	meta.Version = "1.4.0"
	meta.RequestID = c.GetString("request_id")

	c.JSON(200, APIResponse{
		Data: data,
		Meta: meta,
	})
}
```

## Політика версіонування

### Що є Breaking Change

1. **Видалення endpoint**
2. **Видалення поля з response**
3. **Зміна типу поля** (string → number)
4. **Додавання required поля в request**
5. **Зміна семантики поля**
6. **Зміна authentication механізму**
7. **Зміна error codes**

### Що НЕ є Breaking Change

1. **Додавання нового endpoint**
2. **Додавання optional поля в request**
3. **Додавання поля в response**
4. **Додавання нового error code**
5. **Performance improvements**
6. **Bug fixes**

### Deprecation Policy

```
1. Оголошення deprecation → 6 місяців → Sunset
2. Warning headers додаються відразу
3. Documentation оновлюється
4. Email notification клієнтам
5. Після sunset → 410 Gone
```

### Timeline

```
Day 0:     Оголошення deprecation
           - Deprecation header
           - Documentation update
           - Blog post
           - Email to API consumers

Month 1-5: Deprecation period
           - Warning headers
           - Analytics monitoring
           - Support migration

Month 6:   Sunset
           - Endpoint returns 410 Gone
           - Redirect to new endpoint (if applicable)
```

## Changelog Format

```markdown
# API Changelog

## v1.4.0 (2024-01-15)

### Added
- `POST /api/v1/products/bulk` - Bulk product creation
- `GET /api/v1/analytics/sales` - Sales analytics endpoint

### Changed
- `GET /api/v1/products` now supports `fields` parameter for sparse fieldsets

### Deprecated
- `GET /api/v1/products/search` - Use `GET /api/v1/search/products` instead
  - Sunset date: 2024-06-01
  - Migration guide: https://docs.shop-platform.com/migration/search

### Fixed
- Fixed pagination issue in `GET /api/v1/orders`
```

## Client SDK Versioning

```typescript
// TypeScript SDK
import { ShopClient } from '@shop-platform/sdk';

const client = new ShopClient({
  apiKey: 'sk_...',
  apiVersion: '2024-01-15', // Optional: pin to specific version
});

// SDK handles version headers automatically
const products = await client.products.list();
```

```go
// Go SDK
import "github.com/shop-platform/sdk-go"

client := shop.NewClient(
    shop.WithAPIKey("sk_..."),
    shop.WithAPIVersion("2024-01-15"), // Optional
)

products, err := client.Products.List(ctx, nil)
```

## Error Handling для Version Mismatch

```go
// internal/middleware/version_check.go
package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func VersionCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestedVersion := c.GetHeader("X-API-Version")

		// If client explicitly requests unsupported version
		if requestedVersion != "" && !isSupportedVersion(requestedVersion) {
			c.JSON(http.StatusGone, gin.H{
				"error": gin.H{
					"code":    "version_not_supported",
					"message": "The requested API version is no longer supported",
					"details": gin.H{
						"requested_version": requestedVersion,
						"current_version":   CurrentAPIVersion,
						"min_version":       MinAPIVersion,
						"documentation":     "https://docs.shop-platform.com/api/versioning",
					},
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func isSupportedVersion(version string) bool {
	supportedVersions := []string{"1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0"}
	for _, v := range supportedVersions {
		if v == version {
			return true
		}
	}
	return false
}
```

## OpenAPI Spec Versioning

```yaml
# openapi/v1.yaml
openapi: 3.1.0
info:
  title: Shop Platform API
  version: 1.4.0
  x-api-version: v1
  x-changelog: https://docs.shop-platform.com/api/changelog

# Deprecation in OpenAPI
paths:
  /products/search:
    get:
      deprecated: true
      x-sunset: "2024-06-01"
      x-replacement: "/search/products"
      summary: Search products (Deprecated)
      description: |
        **Deprecated**: This endpoint will be removed on 2024-06-01.
        Please use `/search/products` instead.
```

## Наслідки

### Позитивні

- Чітка версія в URL - легко зрозуміти
- Простий routing
- Кешування працює коректно
- Легко документувати

### Негативні

- Потенційно багато паралельних версій
- Дублювання коду між версіями
- Клієнти повинні оновлювати URL

### Ризики

- Занадто часті major versions
- Недостатній deprecation period
- Погана комунікація з клієнтами

## Посилання

- [Stripe API Versioning](https://stripe.com/docs/api/versioning)
- [GitHub API Versioning](https://docs.github.com/en/rest/overview/api-versions)
- [REST API Versioning Best Practices](https://www.freecodecamp.org/news/how-to-version-a-rest-api/)
- [Semantic Versioning](https://semver.org/)
