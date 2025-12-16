package tracing

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

// MetricsConfig holds configuration for OpenTelemetry metrics
type MetricsConfig struct {
	ServiceName    string
	ServiceVersion string
	Environment    string
	OTLPEndpoint   string
	ExportInterval time.Duration
}

// DefaultMetricsConfig returns default metrics configuration
func DefaultMetricsConfig() *MetricsConfig {
	return &MetricsConfig{
		ServiceName:    "core-service",
		ServiceVersion: "1.0.0",
		Environment:    "development",
		OTLPEndpoint:   "localhost:4318",
		ExportInterval: 30 * time.Second,
	}
}

// Metrics holds OpenTelemetry metric instruments
type Metrics struct {
	provider *sdkmetric.MeterProvider
	meter    metric.Meter

	// HTTP metrics
	HTTPRequestsTotal   metric.Int64Counter
	HTTPRequestDuration metric.Float64Histogram
	HTTPActiveRequests  metric.Int64UpDownCounter

	// Business metrics
	OrdersTotal      metric.Int64Counter
	OrderValue       metric.Float64Histogram
	CartAbandoned    metric.Int64Counter
	CheckoutDuration metric.Float64Histogram

	// Database metrics
	DBQueriesTotal    metric.Int64Counter
	DBQueryDuration   metric.Float64Histogram
	DBConnectionsOpen metric.Int64UpDownCounter

	// Cache metrics
	CacheHits   metric.Int64Counter
	CacheMisses metric.Int64Counter

	// External service metrics
	ExternalCallsTotal    metric.Int64Counter
	ExternalCallsDuration metric.Float64Histogram
}

// NewMetrics creates new OpenTelemetry metrics
func NewMetrics(cfg *MetricsConfig) (*Metrics, error) {
	ctx := context.Background()

	// Create OTLP exporter
	exporter, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpoint(cfg.OTLPEndpoint),
		otlpmetrichttp.WithInsecure(),
	)
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

	// Create meter provider
	provider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(
			sdkmetric.NewPeriodicReader(exporter,
				sdkmetric.WithInterval(cfg.ExportInterval),
			),
		),
	)

	// Set global meter provider
	otel.SetMeterProvider(provider)

	meter := provider.Meter(cfg.ServiceName)

	m := &Metrics{
		provider: provider,
		meter:    meter,
	}

	// Initialize HTTP metrics
	m.HTTPRequestsTotal, _ = meter.Int64Counter("http_requests_total",
		metric.WithDescription("Total number of HTTP requests"),
		metric.WithUnit("{requests}"),
	)

	m.HTTPRequestDuration, _ = meter.Float64Histogram("http_request_duration_seconds",
		metric.WithDescription("HTTP request duration in seconds"),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
	)

	m.HTTPActiveRequests, _ = meter.Int64UpDownCounter("http_active_requests",
		metric.WithDescription("Number of active HTTP requests"),
		metric.WithUnit("{requests}"),
	)

	// Initialize business metrics
	m.OrdersTotal, _ = meter.Int64Counter("orders_total",
		metric.WithDescription("Total number of orders"),
		metric.WithUnit("{orders}"),
	)

	m.OrderValue, _ = meter.Float64Histogram("order_value_uah",
		metric.WithDescription("Order value in UAH"),
		metric.WithUnit("UAH"),
		metric.WithExplicitBucketBoundaries(100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000),
	)

	m.CartAbandoned, _ = meter.Int64Counter("cart_abandoned_total",
		metric.WithDescription("Total number of abandoned carts"),
		metric.WithUnit("{carts}"),
	)

	m.CheckoutDuration, _ = meter.Float64Histogram("checkout_duration_seconds",
		metric.WithDescription("Checkout process duration in seconds"),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(1, 5, 10, 30, 60, 120, 300),
	)

	// Initialize database metrics
	m.DBQueriesTotal, _ = meter.Int64Counter("db_queries_total",
		metric.WithDescription("Total number of database queries"),
		metric.WithUnit("{queries}"),
	)

	m.DBQueryDuration, _ = meter.Float64Histogram("db_query_duration_seconds",
		metric.WithDescription("Database query duration in seconds"),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1),
	)

	m.DBConnectionsOpen, _ = meter.Int64UpDownCounter("db_connections_open",
		metric.WithDescription("Number of open database connections"),
		metric.WithUnit("{connections}"),
	)

	// Initialize cache metrics
	m.CacheHits, _ = meter.Int64Counter("cache_hits_total",
		metric.WithDescription("Total number of cache hits"),
		metric.WithUnit("{hits}"),
	)

	m.CacheMisses, _ = meter.Int64Counter("cache_misses_total",
		metric.WithDescription("Total number of cache misses"),
		metric.WithUnit("{misses}"),
	)

	// Initialize external service metrics
	m.ExternalCallsTotal, _ = meter.Int64Counter("external_calls_total",
		metric.WithDescription("Total number of external service calls"),
		metric.WithUnit("{calls}"),
	)

	m.ExternalCallsDuration, _ = meter.Float64Histogram("external_call_duration_seconds",
		metric.WithDescription("External service call duration in seconds"),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
	)

	return m, nil
}

// Shutdown gracefully shuts down the metrics provider
func (m *Metrics) Shutdown(ctx context.Context) error {
	if m.provider == nil {
		return nil
	}
	return m.provider.Shutdown(ctx)
}

// RecordHTTPRequest records an HTTP request metric
func (m *Metrics) RecordHTTPRequest(ctx context.Context, method, path string, statusCode int, duration time.Duration) {
	attrs := []attribute.KeyValue{
		attribute.String("method", method),
		attribute.String("path", normalizePath(path)),
		attribute.Int("status_code", statusCode),
		attribute.String("status_class", statusClass(statusCode)),
	}

	m.HTTPRequestsTotal.Add(ctx, 1, metric.WithAttributes(attrs...))
	m.HTTPRequestDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordOrder records an order metric
func (m *Metrics) RecordOrder(ctx context.Context, status, paymentMethod, shippingMethod string, value float64) {
	attrs := []attribute.KeyValue{
		attribute.String("status", status),
		attribute.String("payment_method", paymentMethod),
		attribute.String("shipping_method", shippingMethod),
	}

	m.OrdersTotal.Add(ctx, 1, metric.WithAttributes(attrs...))
	m.OrderValue.Record(ctx, value, metric.WithAttributes(attrs...))
}

// RecordDBQuery records a database query metric
func (m *Metrics) RecordDBQuery(ctx context.Context, operation, table string, duration time.Duration, success bool) {
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
		attribute.String("table", table),
		attribute.Bool("success", success),
	}

	m.DBQueriesTotal.Add(ctx, 1, metric.WithAttributes(attrs...))
	m.DBQueryDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordCacheAccess records a cache access metric
func (m *Metrics) RecordCacheAccess(ctx context.Context, operation string, hit bool) {
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
	}

	if hit {
		m.CacheHits.Add(ctx, 1, metric.WithAttributes(attrs...))
	} else {
		m.CacheMisses.Add(ctx, 1, metric.WithAttributes(attrs...))
	}
}

// RecordExternalCall records an external service call metric
func (m *Metrics) RecordExternalCall(ctx context.Context, service, operation string, duration time.Duration, success bool) {
	attrs := []attribute.KeyValue{
		attribute.String("service", service),
		attribute.String("operation", operation),
		attribute.Bool("success", success),
	}

	m.ExternalCallsTotal.Add(ctx, 1, metric.WithAttributes(attrs...))
	m.ExternalCallsDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// Helper functions

func normalizePath(path string) string {
	// Normalize paths to reduce cardinality
	// e.g., /products/123 -> /products/:id
	// This should be customized based on your routes
	return path
}

func statusClass(code int) string {
	switch {
	case code >= 500:
		return "5xx"
	case code >= 400:
		return "4xx"
	case code >= 300:
		return "3xx"
	case code >= 200:
		return "2xx"
	default:
		return "1xx"
	}
}
