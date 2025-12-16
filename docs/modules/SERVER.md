# Server Module

Конфігурація та запуск HTTP сервера.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         HTTP Server                                   │   │
│  │                        (net/http + chi)                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│  │ Middleware   │         │   Router     │         │ Graceful     │       │
│  │ Stack        │         │              │         │ Shutdown     │       │
│  └──────────────┘         └──────────────┘         └──────────────┘       │
│         │                          │                                       │
│         ▼                          ▼                                       │
│  ┌──────────────┐         ┌──────────────┐                                │
│  │ - Recovery   │         │ - /api/v1    │                                │
│  │ - Logger     │         │ - /health    │                                │
│  │ - CORS       │         │ - /metrics   │                                │
│  │ - Auth       │         │ - /graphql   │                                │
│  │ - Tenant     │         └──────────────┘                                │
│  │ - Timeout    │                                                          │
│  └──────────────┘                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

```go
// config/server.go
type ServerConfig struct {
    Host            string        `env:"SERVER_HOST" envDefault:"0.0.0.0"`
    Port            int           `env:"SERVER_PORT" envDefault:"8080"`
    ReadTimeout     time.Duration `env:"SERVER_READ_TIMEOUT" envDefault:"30s"`
    WriteTimeout    time.Duration `env:"SERVER_WRITE_TIMEOUT" envDefault:"30s"`
    IdleTimeout     time.Duration `env:"SERVER_IDLE_TIMEOUT" envDefault:"60s"`
    ShutdownTimeout time.Duration `env:"SERVER_SHUTDOWN_TIMEOUT" envDefault:"30s"`
    MaxHeaderBytes  int           `env:"SERVER_MAX_HEADER_BYTES" envDefault:"1048576"`
    TLSCertFile     string        `env:"TLS_CERT_FILE"`
    TLSKeyFile      string        `env:"TLS_KEY_FILE"`
}
```

## Server Implementation

```go
// pkg/server/server.go
package server

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

type Server struct {
    config     *ServerConfig
    router     *chi.Mux
    httpServer *http.Server
    logger     zerolog.Logger
}

func New(cfg *ServerConfig, logger zerolog.Logger) *Server {
    router := chi.NewRouter()

    return &Server{
        config: cfg,
        router: router,
        logger: logger,
    }
}

// SetupMiddleware configures the middleware stack
func (s *Server) SetupMiddleware() {
    // Recovery from panics
    s.router.Use(middleware.Recoverer)

    // Request ID
    s.router.Use(middleware.RequestID)

    // Real IP
    s.router.Use(middleware.RealIP)

    // Logger
    s.router.Use(s.loggingMiddleware)

    // Timeout
    s.router.Use(middleware.Timeout(s.config.WriteTimeout))

    // Compress
    s.router.Use(middleware.Compress(5))

    // CORS
    s.router.Use(s.corsMiddleware)

    // Security headers
    s.router.Use(s.securityHeaders)
}

// Router returns the chi router for route registration
func (s *Server) Router() *chi.Mux {
    return s.router
}

// Start starts the HTTP server
func (s *Server) Start() error {
    addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

    s.httpServer = &http.Server{
        Addr:           addr,
        Handler:        s.router,
        ReadTimeout:    s.config.ReadTimeout,
        WriteTimeout:   s.config.WriteTimeout,
        IdleTimeout:    s.config.IdleTimeout,
        MaxHeaderBytes: s.config.MaxHeaderBytes,
    }

    // Start server in goroutine
    go func() {
        s.logger.Info().Str("addr", addr).Msg("Starting HTTP server")

        var err error
        if s.config.TLSCertFile != "" && s.config.TLSKeyFile != "" {
            err = s.httpServer.ListenAndServeTLS(s.config.TLSCertFile, s.config.TLSKeyFile)
        } else {
            err = s.httpServer.ListenAndServe()
        }

        if err != nil && err != http.ErrServerClosed {
            s.logger.Fatal().Err(err).Msg("Server failed")
        }
    }()

    return nil
}

// WaitForShutdown waits for interrupt signal and gracefully shuts down
func (s *Server) WaitForShutdown() {
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    sig := <-quit
    s.logger.Info().Str("signal", sig.String()).Msg("Shutdown signal received")

    s.Shutdown()
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown() {
    ctx, cancel := context.WithTimeout(context.Background(), s.config.ShutdownTimeout)
    defer cancel()

    s.logger.Info().Msg("Shutting down server...")

    if err := s.httpServer.Shutdown(ctx); err != nil {
        s.logger.Error().Err(err).Msg("Server forced to shutdown")
    }

    s.logger.Info().Msg("Server stopped")
}
```

## Middleware

### Logging Middleware

```go
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

        defer func() {
            s.logger.Info().
                Str("method", r.Method).
                Str("path", r.URL.Path).
                Str("remote", r.RemoteAddr).
                Int("status", ww.Status()).
                Int("bytes", ww.BytesWritten()).
                Dur("duration", time.Since(start)).
                Str("request_id", middleware.GetReqID(r.Context())).
                Msg("HTTP request")
        }()

        next.ServeHTTP(ww, r)
    })
}
```

### CORS Middleware

```go
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")

        // Allow specific origins or all for development
        if s.isAllowedOrigin(origin) {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Access-Control-Allow-Credentials", "true")
        }

        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Tenant-ID, X-Request-ID")
        w.Header().Set("Access-Control-Max-Age", "86400")

        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusNoContent)
            return
        }

        next.ServeHTTP(w, r)
    })
}

func (s *Server) isAllowedOrigin(origin string) bool {
    allowedOrigins := []string{
        "https://shop.ua",
        "https://admin.shop.ua",
        "http://localhost:3000",
    }

    for _, allowed := range allowedOrigins {
        if origin == allowed {
            return true
        }
    }
    return false
}
```

### Security Headers

```go
func (s *Server) securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")

        next.ServeHTTP(w, r)
    })
}
```

## Route Registration

```go
// cmd/core/main.go
func main() {
    // Initialize server
    srv := server.New(cfg.Server, logger)
    srv.SetupMiddleware()

    router := srv.Router()

    // Health & Metrics (no auth)
    router.Get("/health", handlers.Health)
    router.Get("/ready", handlers.Ready)
    router.Handle("/metrics", promhttp.Handler())

    // API v1
    router.Route("/api/v1", func(r chi.Router) {
        // Tenant middleware
        r.Use(tenant.Middleware(tenantResolver))

        // Public routes
        r.Group(func(r chi.Router) {
            r.Get("/products", productHandler.List)
            r.Get("/products/{id}", productHandler.Get)
            r.Get("/categories", categoryHandler.List)
        })

        // Authenticated routes
        r.Group(func(r chi.Router) {
            r.Use(auth.Middleware(authService))

            // Orders
            r.Route("/orders", func(r chi.Router) {
                r.Get("/", orderHandler.List)
                r.Post("/", orderHandler.Create)
                r.Get("/{id}", orderHandler.Get)
            })

            // Cart
            r.Route("/cart", func(r chi.Router) {
                r.Get("/", cartHandler.Get)
                r.Post("/items", cartHandler.AddItem)
                r.Delete("/items/{id}", cartHandler.RemoveItem)
            })
        })

        // Admin routes
        r.Route("/admin", func(r chi.Router) {
            r.Use(auth.Middleware(authService))
            r.Use(auth.RequireRole("admin"))

            r.Route("/products", func(r chi.Router) {
                r.Post("/", productHandler.Create)
                r.Put("/{id}", productHandler.Update)
                r.Delete("/{id}", productHandler.Delete)
            })
        })
    })

    // GraphQL
    router.Handle("/graphql", graphqlHandler)

    // Webhooks
    router.Route("/webhooks", func(r chi.Router) {
        r.Post("/liqpay", webhookHandler.LiqPay)
        r.Post("/monobank", webhookHandler.Monobank)
        r.Post("/novaposhta", webhookHandler.NovaPoshta)
    })

    // Start server
    srv.Start()
    srv.WaitForShutdown()
}
```

## Health Endpoints

```go
// handlers/health.go
func Health(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "status": "ok",
    })
}

func Ready(deps *Dependencies) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        checks := map[string]string{}

        // Check database
        if err := deps.DB.Ping(); err != nil {
            checks["database"] = "unhealthy"
        } else {
            checks["database"] = "healthy"
        }

        // Check Redis
        if err := deps.Redis.Ping(r.Context()).Err(); err != nil {
            checks["redis"] = "unhealthy"
        } else {
            checks["redis"] = "healthy"
        }

        // Determine overall status
        status := http.StatusOK
        for _, v := range checks {
            if v == "unhealthy" {
                status = http.StatusServiceUnavailable
                break
            }
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(status)
        json.NewEncoder(w).Encode(checks)
    }
}
```

## Application Lifecycle

```go
// cmd/core/main.go
func main() {
    // Load configuration
    cfg := config.Load()

    // Initialize logger
    logger.Init(&cfg.Logger)

    // Initialize tracer
    tracer.Init(&cfg.Tracer)
    defer tracer.Close()

    // Initialize metrics
    metrics.Init()

    // Connect to database
    db, err := database.Connect(&cfg.Database)
    if err != nil {
        log.Fatal().Err(err).Msg("connect to database")
    }
    defer db.Close()

    // Run migrations
    if err := migrate.Up(db); err != nil {
        log.Fatal().Err(err).Msg("run migrations")
    }

    // Connect to Redis
    redis := redis.Connect(&cfg.Redis)
    defer redis.Close()

    // Initialize services
    deps := initDependencies(cfg, db, redis)

    // Initialize server
    srv := server.New(&cfg.Server, log.Logger)
    srv.SetupMiddleware()
    registerRoutes(srv.Router(), deps)

    // Start background workers
    startWorkers(deps)

    // Start server
    srv.Start()

    // Wait for shutdown
    srv.WaitForShutdown()

    // Cleanup
    stopWorkers()
    log.Info().Msg("Application stopped")
}
```

## See Also

- [Health Checks](./HEALTH_CHECKS.md)
- [Metrics Module](./METRICS.md)
- [Rate Limiting](../architecture/RATE_LIMITING.md)
