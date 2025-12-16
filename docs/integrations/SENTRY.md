# Sentry Integration

Інтеграція з Sentry для моніторингу помилок та продуктивності.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SENTRY INTEGRATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Application Services                           │   │
│  │                                                                        │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │   │ Storefront │  │ Core       │  │ OMS        │  │ Admin      │    │   │
│  │   │ (Next.js)  │  │ (Go)       │  │ (Go)       │  │ (Next.js)  │    │   │
│  │   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │   │
│  └─────────┼───────────────┼───────────────┼───────────────┼───────────┘   │
│            │               │               │               │               │
│            ▼               ▼               ▼               ▼               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           Sentry Platform                             │   │
│  │                                                                        │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │   │ Error      │  │ Performance│  │ Session    │  │ Alerts     │    │   │
│  │   │ Tracking   │  │ Monitoring │  │ Replay     │  │            │    │   │
│  │   └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Sentry Configuration
SENTRY_DSN=https://xxx@sentry.io/123
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=shop@1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Frontend
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/456
```

## Backend Integration (Go)

### Initialization

```go
// pkg/sentry/init.go
package sentry

import (
    "time"

    "github.com/getsentry/sentry-go"
)

type Config struct {
    DSN              string  `env:"SENTRY_DSN,required"`
    Environment      string  `env:"SENTRY_ENVIRONMENT" envDefault:"development"`
    Release          string  `env:"SENTRY_RELEASE"`
    TracesSampleRate float64 `env:"SENTRY_TRACES_SAMPLE_RATE" envDefault:"0.1"`
    Debug            bool    `env:"SENTRY_DEBUG" envDefault:"false"`
}

func Init(cfg *Config) error {
    return sentry.Init(sentry.ClientOptions{
        Dsn:              cfg.DSN,
        Environment:      cfg.Environment,
        Release:          cfg.Release,
        TracesSampleRate: cfg.TracesSampleRate,
        Debug:            cfg.Debug,

        // Enable profiling
        EnableTracing:      true,
        ProfilesSampleRate: 0.1,

        // Before send hook
        BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
            // Filter out specific errors
            if shouldIgnore(event) {
                return nil
            }
            return event
        },

        // Integration options
        AttachStacktrace: true,
    })
}

func shouldIgnore(event *sentry.Event) bool {
    // Ignore context canceled errors
    if event.Exception != nil {
        for _, ex := range event.Exception {
            if ex.Value == "context canceled" {
                return true
            }
        }
    }
    return false
}

// Flush flushes any buffered events
func Flush() {
    sentry.Flush(2 * time.Second)
}
```

### Error Capture

```go
// pkg/sentry/capture.go
package sentry

import (
    "context"
    "fmt"

    "github.com/getsentry/sentry-go"
)

// CaptureError captures an error with context
func CaptureError(ctx context.Context, err error, extras map[string]interface{}) {
    hub := sentry.GetHubFromContext(ctx)
    if hub == nil {
        hub = sentry.CurrentHub()
    }

    hub.WithScope(func(scope *sentry.Scope) {
        // Add extras
        for k, v := range extras {
            scope.SetExtra(k, v)
        }

        // Add context values
        if tenantID := ctx.Value("tenant_id"); tenantID != nil {
            scope.SetTag("tenant_id", tenantID.(string))
        }
        if userID := ctx.Value("user_id"); userID != nil {
            scope.SetUser(sentry.User{ID: userID.(string)})
        }

        hub.CaptureException(err)
    })
}

// CaptureMessage captures a message
func CaptureMessage(ctx context.Context, message string, level sentry.Level) {
    hub := sentry.GetHubFromContext(ctx)
    if hub == nil {
        hub = sentry.CurrentHub()
    }

    hub.WithScope(func(scope *sentry.Scope) {
        scope.SetLevel(level)
        hub.CaptureMessage(message)
    })
}

// AddBreadcrumb adds a breadcrumb to the current scope
func AddBreadcrumb(ctx context.Context, category, message string) {
    hub := sentry.GetHubFromContext(ctx)
    if hub == nil {
        hub = sentry.CurrentHub()
    }

    hub.AddBreadcrumb(&sentry.Breadcrumb{
        Category: category,
        Message:  message,
        Level:    sentry.LevelInfo,
    }, nil)
}
```

### HTTP Middleware

```go
// pkg/sentry/middleware.go
package sentry

import (
    "context"
    "net/http"

    sentryhttp "github.com/getsentry/sentry-go/http"
)

// NewMiddleware creates Sentry HTTP middleware
func NewMiddleware() func(http.Handler) http.Handler {
    return sentryhttp.New(sentryhttp.Options{
        Repanic:         true,
        WaitForDelivery: false,
    }).Handle
}

// Custom middleware with more context
func EnrichMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        hub := sentry.GetHubFromContext(r.Context())
        if hub == nil {
            hub = sentry.CurrentHub().Clone()
        }

        hub.Scope().SetRequest(r)

        // Add tenant context
        if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
            hub.Scope().SetTag("tenant_id", tenantID)
        }

        // Add user context
        if userID := r.Context().Value("user_id"); userID != nil {
            hub.Scope().SetUser(sentry.User{
                ID: userID.(string),
            })
        }

        ctx := sentry.SetHubOnContext(r.Context(), hub)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Transaction Tracing

```go
// pkg/sentry/tracing.go
package sentry

import (
    "context"

    "github.com/getsentry/sentry-go"
)

// StartTransaction starts a new Sentry transaction
func StartTransaction(ctx context.Context, name, op string) (*sentry.Span, context.Context) {
    hub := sentry.GetHubFromContext(ctx)
    if hub == nil {
        hub = sentry.CurrentHub()
    }

    options := []sentry.SpanOption{
        sentry.OpName(op),
        sentry.TransactionName(name),
    }

    span := sentry.StartSpan(ctx, op, options...)
    return span, span.Context()
}

// StartSpan starts a child span
func StartSpan(ctx context.Context, op, description string) (*sentry.Span, context.Context) {
    span := sentry.StartSpan(ctx, op)
    span.Description = description
    return span, span.Context()
}

// Example usage in service
func (s *OrderService) CreateOrder(ctx context.Context, order *Order) error {
    span, ctx := StartTransaction(ctx, "CreateOrder", "order.create")
    defer span.Finish()

    // Database operation
    dbSpan, dbCtx := StartSpan(ctx, "db.query", "INSERT order")
    err := s.repo.Create(dbCtx, order)
    dbSpan.Finish()
    if err != nil {
        CaptureError(ctx, err, map[string]interface{}{
            "order_id": order.ID,
        })
        return err
    }

    // External API call
    apiSpan, apiCtx := StartSpan(ctx, "http.client", "POST payment")
    err = s.paymentService.Process(apiCtx, order)
    apiSpan.Finish()

    return err
}
```

### Error Recovery

```go
// Recovery middleware
func RecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                hub := sentry.GetHubFromContext(r.Context())
                if hub == nil {
                    hub = sentry.CurrentHub()
                }

                hub.RecoverWithContext(r.Context(), err)

                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            }
        }()

        next.ServeHTTP(w, r)
    })
}
```

## Frontend Integration (Next.js)

### Installation

```bash
npm install @sentry/nextjs
```

### Configuration

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // Performance Monitoring
  tracesSampleRate: 0.1,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Filter errors
  beforeSend(event, hint) {
    // Filter out specific errors
    if (event.exception) {
      const error = hint.originalException;
      if (error?.message?.includes('ResizeObserver')) {
        return null;
      }
    }
    return event;
  },
});
```

### Server Config

```javascript
// sentry.server.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
```

### Next.js Config

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

const moduleExports = {
  // Your existing config
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: 'your-org',
  project: 'shop-storefront',
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = withSentryConfig(moduleExports, sentryWebpackPluginOptions);
```

### Error Boundary

```tsx
// components/ErrorBoundary.tsx
import * as Sentry from '@sentry/nextjs';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, eventId: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setExtras({ componentStack: errorInfo.componentStack });
      const eventId = Sentry.captureException(error);
      this.setState({ eventId });
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-fallback">
            <h2>Щось пішло не так</h2>
            <button
              onClick={() =>
                Sentry.showReportDialog({ eventId: this.state.eventId! })
              }
            >
              Повідомити про помилку
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### Custom Error Capturing

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

export function captureOrderError(error: Error, orderData: any) {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'checkout');
    scope.setContext('order', {
      id: orderData.id,
      total: orderData.total,
      items: orderData.items.length,
    });
    Sentry.captureException(error);
  });
}

export function capturePaymentError(error: Error, paymentData: any) {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'payment');
    scope.setTag('payment_method', paymentData.method);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
}

// Usage
try {
  await processPayment(data);
} catch (error) {
  capturePaymentError(error, { method: 'liqpay', amount: 1000 });
  throw error;
}
```

### Performance Monitoring

```typescript
// lib/tracing.ts
import * as Sentry from '@sentry/nextjs';

export function traceAPICall<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: 'http.client',
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2 }); // Error
        throw error;
      }
    }
  );
}

// Usage
const products = await traceAPICall('fetchProducts', () =>
  api.get('/products')
);
```

## Alerts Configuration

### Alert Rules

```yaml
# Sentry alert rules (configured via UI or Terraform)

# High error rate
- name: "High Error Rate"
  conditions:
    - type: event_frequency
      value: 100
      interval: 1h
  actions:
    - type: slack
      channel: "#alerts-critical"
    - type: email
      targetType: team

# New issue in production
- name: "New Production Issue"
  conditions:
    - type: first_seen_event
      environment: production
  actions:
    - type: slack
      channel: "#alerts-production"

# Payment errors
- name: "Payment Errors"
  conditions:
    - type: event_frequency
      value: 5
      interval: 5m
    - type: tags
      key: feature
      value: payment
  actions:
    - type: pagerduty
      service: payments-oncall
```

## Source Maps

### Upload Source Maps

```bash
# Upload source maps during build
npx @sentry/cli sourcemaps upload \
  --org your-org \
  --project shop-storefront \
  --release shop@1.0.0 \
  .next/static/chunks
```

### GitHub Integration

```yaml
# .github/workflows/deploy.yml
- name: Create Sentry release
  uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: shop-storefront
  with:
    environment: production
    sourcemaps: '.next/static/chunks'
```

## Filtering and Sampling

### Smart Sampling

```go
// Custom sampler
func customSampler(ctx sentry.SamplingContext) float64 {
    // Always sample errors
    if ctx.Parent != nil && ctx.Parent.Sampled == sentry.SampledTrue {
        return 1.0
    }

    // Sample based on transaction name
    name := ctx.TransactionContext.Name
    switch {
    case strings.HasPrefix(name, "POST /api/orders"):
        return 1.0 // Always sample order creation
    case strings.HasPrefix(name, "GET /api/products"):
        return 0.01 // Low sample rate for product listing
    default:
        return 0.1
    }
}
```

## See Also

- [Monitoring Setup](../operations/MONITORING_SETUP.md)
- [Alerting Rules](../operations/ALERTING_RULES.md)
- [Datadog Integration](./DATADOG.md)
