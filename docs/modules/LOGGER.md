# Logger Module

Структуроване логування для всіх сервісів платформи.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOGGING ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Application  │────▶│ Structured   │────▶│ Log          │                │
│  │ Code         │     │ Logger       │     │ Aggregator   │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                              │                    │                         │
│                              ▼                    ▼                         │
│                       ┌──────────────┐     ┌──────────────┐                │
│                       │ JSON Output  │     │ Loki/ELK     │                │
│                       │ (stdout)     │     │ Storage      │                │
│                       └──────────────┘     └──────────────┘                │
│                                                                              │
│  Features:                                                                  │
│  ├── Structured JSON logging                                                │
│  ├── Log levels (debug, info, warn, error)                                 │
│  ├── Context propagation (trace_id, tenant_id)                             │
│  ├── Sensitive data masking                                                 │
│  └── Performance optimized (zerolog)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Log configuration
LOG_LEVEL=info              # debug, info, warn, error
LOG_FORMAT=json             # json, console
LOG_OUTPUT=stdout           # stdout, stderr, file
LOG_FILE_PATH=/var/log/app.log
LOG_CALLER=true             # Include caller info
LOG_TIMESTAMP_FORMAT=rfc3339
```

### Go Configuration

```go
// config/logger.go
type LoggerConfig struct {
    Level           string `env:"LOG_LEVEL" envDefault:"info"`
    Format          string `env:"LOG_FORMAT" envDefault:"json"`
    Output          string `env:"LOG_OUTPUT" envDefault:"stdout"`
    FilePath        string `env:"LOG_FILE_PATH"`
    IncludeCaller   bool   `env:"LOG_CALLER" envDefault:"true"`
    TimestampFormat string `env:"LOG_TIMESTAMP_FORMAT" envDefault:"rfc3339"`
}
```

## Implementation

### Logger Initialization

```go
// pkg/logger/logger.go
package logger

import (
    "io"
    "os"
    "time"

    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

var Logger zerolog.Logger

func Init(cfg *LoggerConfig) {
    // Set log level
    level, err := zerolog.ParseLevel(cfg.Level)
    if err != nil {
        level = zerolog.InfoLevel
    }
    zerolog.SetGlobalLevel(level)

    // Set timestamp format
    zerolog.TimeFieldFormat = time.RFC3339Nano

    // Configure output
    var output io.Writer = os.Stdout
    if cfg.Output == "stderr" {
        output = os.Stderr
    } else if cfg.Output == "file" && cfg.FilePath != "" {
        file, err := os.OpenFile(cfg.FilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
        if err == nil {
            output = file
        }
    }

    // Console format for development
    if cfg.Format == "console" {
        output = zerolog.ConsoleWriter{
            Out:        output,
            TimeFormat: "15:04:05",
        }
    }

    // Build logger
    ctx := zerolog.New(output).With().Timestamp()

    if cfg.IncludeCaller {
        ctx = ctx.Caller()
    }

    // Add service info
    ctx = ctx.
        Str("service", os.Getenv("SERVICE_NAME")).
        Str("version", os.Getenv("SERVICE_VERSION")).
        Str("env", os.Getenv("ENV"))

    Logger = ctx.Logger()
    log.Logger = Logger
}
```

### Context-Aware Logging

```go
// pkg/logger/context.go
package logger

import (
    "context"

    "github.com/rs/zerolog"
)

type ctxKey struct{}

// WithContext adds logger to context
func WithContext(ctx context.Context, l zerolog.Logger) context.Context {
    return context.WithValue(ctx, ctxKey{}, l)
}

// FromContext retrieves logger from context
func FromContext(ctx context.Context) zerolog.Logger {
    if l, ok := ctx.Value(ctxKey{}).(zerolog.Logger); ok {
        return l
    }
    return Logger
}

// WithFields adds fields to logger in context
func WithFields(ctx context.Context, fields map[string]interface{}) context.Context {
    l := FromContext(ctx)
    for k, v := range fields {
        l = l.With().Interface(k, v).Logger()
    }
    return WithContext(ctx, l)
}

// WithTenant adds tenant_id to logger
func WithTenant(ctx context.Context, tenantID string) context.Context {
    l := FromContext(ctx).With().Str("tenant_id", tenantID).Logger()
    return WithContext(ctx, l)
}

// WithUser adds user_id to logger
func WithUser(ctx context.Context, userID string) context.Context {
    l := FromContext(ctx).With().Str("user_id", userID).Logger()
    return WithContext(ctx, l)
}

// WithRequestID adds request_id to logger
func WithRequestID(ctx context.Context, requestID string) context.Context {
    l := FromContext(ctx).With().Str("request_id", requestID).Logger()
    return WithContext(ctx, l)
}

// WithTraceID adds trace context for distributed tracing
func WithTraceID(ctx context.Context, traceID, spanID string) context.Context {
    l := FromContext(ctx).With().
        Str("trace_id", traceID).
        Str("span_id", spanID).
        Logger()
    return WithContext(ctx, l)
}
```

### HTTP Middleware

```go
// pkg/logger/middleware.go
package logger

import (
    "net/http"
    "time"

    "github.com/google/uuid"
)

func Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()

        // Generate or extract request ID
        requestID := r.Header.Get("X-Request-ID")
        if requestID == "" {
            requestID = uuid.New().String()
        }

        // Extract tenant ID
        tenantID := r.Header.Get("X-Tenant-ID")

        // Create logger with context
        l := Logger.With().
            Str("request_id", requestID).
            Str("method", r.Method).
            Str("path", r.URL.Path).
            Str("remote_addr", r.RemoteAddr).
            Str("user_agent", r.UserAgent()).
            Logger()

        if tenantID != "" {
            l = l.With().Str("tenant_id", tenantID).Logger()
        }

        // Add to context
        ctx := WithContext(r.Context(), l)

        // Wrap response writer to capture status
        rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}

        // Process request
        next.ServeHTTP(rw, r.WithContext(ctx))

        // Log request completion
        duration := time.Since(start)
        l.Info().
            Int("status", rw.status).
            Int("size", rw.size).
            Dur("duration", duration).
            Msg("HTTP request completed")
    })
}

type responseWriter struct {
    http.ResponseWriter
    status int
    size   int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
    size, err := rw.ResponseWriter.Write(b)
    rw.size += size
    return size, err
}
```

## Usage Patterns

### Basic Logging

```go
import "shop/pkg/logger"

func main() {
    // Initialize logger
    logger.Init(&logger.LoggerConfig{
        Level:  "info",
        Format: "json",
    })

    // Simple logging
    logger.Logger.Info().Msg("Application started")

    // With fields
    logger.Logger.Info().
        Str("order_id", "ord_123").
        Float64("amount", 1500.00).
        Msg("Order created")

    // Error logging
    logger.Logger.Error().
        Err(err).
        Str("operation", "payment").
        Msg("Payment failed")
}
```

### Context-Aware Logging

```go
func (s *OrderService) CreateOrder(ctx context.Context, order *Order) error {
    log := logger.FromContext(ctx)

    log.Info().
        Str("order_id", order.ID).
        Msg("Creating order")

    // Add more context
    ctx = logger.WithFields(ctx, map[string]interface{}{
        "order_id": order.ID,
        "customer_id": order.CustomerID,
    })

    if err := s.validateOrder(ctx, order); err != nil {
        log.Error().Err(err).Msg("Order validation failed")
        return err
    }

    log.Info().Msg("Order created successfully")
    return nil
}
```

### Structured Error Logging

```go
// pkg/logger/errors.go
package logger

import (
    "context"
    "runtime"

    "github.com/rs/zerolog"
)

// LogError logs error with stack trace
func LogError(ctx context.Context, err error, msg string) {
    log := FromContext(ctx)

    // Get caller info
    _, file, line, _ := runtime.Caller(1)

    log.Error().
        Err(err).
        Str("file", file).
        Int("line", line).
        Stack().
        Msg(msg)
}

// LogErrorWithFields logs error with additional fields
func LogErrorWithFields(ctx context.Context, err error, msg string, fields map[string]interface{}) {
    log := FromContext(ctx)

    event := log.Error().Err(err)
    for k, v := range fields {
        event = event.Interface(k, v)
    }
    event.Msg(msg)
}
```

## Sensitive Data Masking

### Masking Implementation

```go
// pkg/logger/mask.go
package logger

import (
    "regexp"
    "strings"
)

var (
    emailRegex = regexp.MustCompile(`([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`)
    phoneRegex = regexp.MustCompile(`\+?[0-9]{10,15}`)
    cardRegex  = regexp.MustCompile(`[0-9]{13,19}`)
)

// MaskEmail masks email address
func MaskEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) != 2 {
        return "***"
    }
    name := parts[0]
    if len(name) > 2 {
        name = name[:2] + strings.Repeat("*", len(name)-2)
    }
    return name + "@" + parts[1]
}

// MaskPhone masks phone number
func MaskPhone(phone string) string {
    if len(phone) < 4 {
        return "***"
    }
    return phone[:3] + strings.Repeat("*", len(phone)-6) + phone[len(phone)-3:]
}

// MaskCard masks credit card number
func MaskCard(card string) string {
    if len(card) < 8 {
        return "***"
    }
    return card[:4] + strings.Repeat("*", len(card)-8) + card[len(card)-4:]
}

// MaskSensitiveData masks sensitive data in string
func MaskSensitiveData(data string) string {
    data = emailRegex.ReplaceAllStringFunc(data, MaskEmail)
    data = phoneRegex.ReplaceAllStringFunc(data, MaskPhone)
    data = cardRegex.ReplaceAllStringFunc(data, MaskCard)
    return data
}

// SafeLog creates a logger that masks sensitive data
type SafeLogger struct {
    zerolog.Logger
}

func (l SafeLogger) SafeStr(key, value string) *zerolog.Event {
    return l.Info().Str(key, MaskSensitiveData(value))
}
```

### Usage

```go
func (s *CustomerService) LogCustomer(ctx context.Context, customer *Customer) {
    log := logger.FromContext(ctx)

    log.Info().
        Str("customer_id", customer.ID).
        Str("email", logger.MaskEmail(customer.Email)).
        Str("phone", logger.MaskPhone(customer.Phone)).
        Msg("Customer info")
}
```

## Log Levels Usage

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Detailed debugging | SQL queries, full request/response |
| `info` | Normal operations | Request completed, order created |
| `warn` | Potential issues | Slow query, retry attempt |
| `error` | Errors that need attention | Failed payment, database error |
| `fatal` | Critical errors (exit) | Cannot connect to database |

```go
// Examples
log.Debug().
    Str("query", sql).
    Dur("duration", duration).
    Msg("SQL query executed")

log.Info().
    Str("order_id", orderID).
    Msg("Order created")

log.Warn().
    Dur("duration", duration).
    Msg("Slow database query")

log.Error().
    Err(err).
    Str("payment_id", paymentID).
    Msg("Payment processing failed")

log.Fatal().
    Err(err).
    Msg("Cannot connect to database")
```

## Log Aggregation

### Loki Configuration

```yaml
# docker-compose.yml
loki:
  image: grafana/loki:2.9.0
  ports:
    - "3100:3100"
  volumes:
    - ./loki-config.yaml:/etc/loki/local-config.yaml
  command: -config.file=/etc/loki/local-config.yaml

promtail:
  image: grafana/promtail:2.9.0
  volumes:
    - /var/log:/var/log
    - ./promtail-config.yaml:/etc/promtail/config.yaml
  command: -config.file=/etc/promtail/config.yaml
```

### Promtail Pipeline

```yaml
# promtail-config.yaml
scrape_configs:
  - job_name: shop
    static_configs:
      - targets:
          - localhost
        labels:
          job: shop
          __path__: /var/log/shop/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            service: service
            tenant_id: tenant_id
            trace_id: trace_id
      - labels:
          level:
          service:
          tenant_id:
```

## Grafana Queries

```logql
# All errors in last hour
{job="shop"} |= "error"

# Errors by service
sum by (service) (count_over_time({job="shop", level="error"}[1h]))

# Slow requests
{job="shop"} | json | duration > 1s

# Requests for specific tenant
{job="shop", tenant_id="tenant_123"}

# Trace specific request
{job="shop"} |= "trace_id=abc123"
```

## Best Practices

### Do's
1. Use structured logging (JSON)
2. Include context (tenant_id, request_id, trace_id)
3. Mask sensitive data
4. Use appropriate log levels
5. Log at service boundaries

### Don'ts
1. Don't log passwords or secrets
2. Don't log full credit card numbers
3. Don't use fmt.Println for logging
4. Don't log too verbosely in production
5. Don't include PII without masking

## See Also

- [Tracing Module](./TRACING.md)
- [Metrics Module](./METRICS.md)
- [Monitoring Setup](../operations/MONITORING_SETUP.md)
