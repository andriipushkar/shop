package tracing

import (
	"context"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// Config holds tracing configuration
type Config struct {
	ServiceName    string
	ServiceVersion string
	Environment    string
	OTLPEndpoint   string // e.g., "localhost:4318" for Jaeger
	SampleRate     float64
	Enabled        bool
}

// DefaultConfig returns default tracing config
func DefaultConfig() *Config {
	return &Config{
		ServiceName:    "core-service",
		ServiceVersion: "1.0.0",
		Environment:    "development",
		OTLPEndpoint:   "localhost:4318",
		SampleRate:     1.0,
		Enabled:        true,
	}
}

// Tracer wraps OpenTelemetry tracer
type Tracer struct {
	provider *sdktrace.TracerProvider
	tracer   trace.Tracer
	config   *Config
}

// New creates a new tracer
func New(cfg *Config) (*Tracer, error) {
	if !cfg.Enabled {
		return &Tracer{config: cfg}, nil
	}

	ctx := context.Background()

	// Create OTLP exporter
	client := otlptracehttp.NewClient(
		otlptracehttp.WithEndpoint(cfg.OTLPEndpoint),
		otlptracehttp.WithInsecure(),
	)

	exporter, err := otlptrace.New(ctx, client)
	if err != nil {
		return nil, err
	}

	// Create resource
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
			attribute.String("environment", cfg.Environment),
		),
	)
	if err != nil {
		return nil, err
	}

	// Create sampler
	var sampler sdktrace.Sampler
	if cfg.SampleRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else if cfg.SampleRate <= 0 {
		sampler = sdktrace.NeverSample()
	} else {
		sampler = sdktrace.TraceIDRatioBased(cfg.SampleRate)
	}

	// Create tracer provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	// Set global tracer provider
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	tracer := provider.Tracer(cfg.ServiceName)

	return &Tracer{
		provider: provider,
		tracer:   tracer,
		config:   cfg,
	}, nil
}

// Shutdown gracefully shuts down the tracer
func (t *Tracer) Shutdown(ctx context.Context) error {
	if t.provider == nil {
		return nil
	}
	return t.provider.Shutdown(ctx)
}

// Start starts a new span
func (t *Tracer) Start(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	if t.tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}
	return t.tracer.Start(ctx, name, opts...)
}

// SpanFromContext returns the current span from context
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// AddEvent adds an event to the current span
func AddEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.AddEvent(name, trace.WithAttributes(attrs...))
}

// SetAttributes sets attributes on the current span
func SetAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attrs...)
}

// RecordError records an error on the current span
func RecordError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	span.RecordError(err)
}

// Middleware returns HTTP middleware for tracing
func (t *Tracer) Middleware(next http.Handler) http.Handler {
	if t.tracer == nil {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract trace context from incoming request
		ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))

		// Start span
		spanName := r.Method + " " + r.URL.Path
		ctx, span := t.tracer.Start(ctx, spanName,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				semconv.HTTPMethod(r.Method),
				semconv.HTTPTarget(r.URL.Path),
				semconv.HTTPScheme(r.URL.Scheme),
				semconv.NetHostName(r.Host),
				attribute.String("http.user_agent", r.UserAgent()),
			),
		)
		defer span.End()

		// Wrap response writer to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Process request
		start := time.Now()
		next.ServeHTTP(rw, r.WithContext(ctx))
		duration := time.Since(start)

		// Add response attributes
		span.SetAttributes(
			semconv.HTTPStatusCode(rw.statusCode),
			attribute.Int64("http.response_time_ms", duration.Milliseconds()),
		)

		// Mark span as error if status >= 400
		if rw.statusCode >= 400 {
			span.SetAttributes(attribute.Bool("error", true))
		}
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// DBSpan creates a span for database operations
func (t *Tracer) DBSpan(ctx context.Context, operation, query string) (context.Context, trace.Span) {
	if t.tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}

	return t.tracer.Start(ctx, "db."+operation,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			semconv.DBSystemPostgreSQL,
			semconv.DBOperation(operation),
			semconv.DBStatement(query),
		),
	)
}

// CacheSpan creates a span for cache operations
func (t *Tracer) CacheSpan(ctx context.Context, operation, key string) (context.Context, trace.Span) {
	if t.tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}

	return t.tracer.Start(ctx, "cache."+operation,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			semconv.DBSystemRedis,
			semconv.DBOperation(operation),
			attribute.String("cache.key", key),
		),
	)
}

// ExternalSpan creates a span for external service calls
func (t *Tracer) ExternalSpan(ctx context.Context, service, operation string) (context.Context, trace.Span) {
	if t.tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}

	return t.tracer.Start(ctx, "external."+service+"."+operation,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("external.service", service),
			attribute.String("external.operation", operation),
		),
	)
}

// SearchSpan creates a span for search operations
func (t *Tracer) SearchSpan(ctx context.Context, operation, query string) (context.Context, trace.Span) {
	if t.tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}

	return t.tracer.Start(ctx, "search."+operation,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "elasticsearch"),
			semconv.DBOperation(operation),
			attribute.String("search.query", query),
		),
	)
}
