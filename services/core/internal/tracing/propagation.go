package tracing

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// InjectHTTPHeaders injects trace context into HTTP headers for outgoing requests
func InjectHTTPHeaders(ctx context.Context, req *http.Request) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))
}

// ExtractHTTPHeaders extracts trace context from HTTP headers for incoming requests
func ExtractHTTPHeaders(ctx context.Context, req *http.Request) context.Context {
	return otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(req.Header))
}

// InjectMapCarrier injects trace context into a map (for message queues like RabbitMQ)
func InjectMapCarrier(ctx context.Context, carrier map[string]string) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.MapCarrier(carrier))
}

// ExtractMapCarrier extracts trace context from a map
func ExtractMapCarrier(ctx context.Context, carrier map[string]string) context.Context {
	return otel.GetTextMapPropagator().Extract(ctx, propagation.MapCarrier(carrier))
}

// TracedHTTPClient wraps http.Client with automatic trace propagation
type TracedHTTPClient struct {
	client      *http.Client
	serviceName string
}

// NewTracedHTTPClient creates a new traced HTTP client
func NewTracedHTTPClient(client *http.Client, serviceName string) *TracedHTTPClient {
	if client == nil {
		client = http.DefaultClient
	}
	return &TracedHTTPClient{
		client:      client,
		serviceName: serviceName,
	}
}

// Do executes the request with trace propagation
func (c *TracedHTTPClient) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	tracer := otel.Tracer(c.serviceName)

	// Start a client span
	ctx, span := tracer.Start(ctx, "HTTP "+req.Method+" "+req.URL.Path,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("http.method", req.Method),
			attribute.String("http.url", req.URL.String()),
			attribute.String("http.host", req.URL.Host),
			attribute.String("net.peer.name", req.URL.Hostname()),
		),
	)
	defer span.End()

	// Inject trace context into headers
	InjectHTTPHeaders(ctx, req)

	// Execute request
	resp, err := c.client.Do(req.WithContext(ctx))
	if err != nil {
		span.RecordError(err)
		span.SetAttributes(attribute.Bool("error", true))
		return nil, err
	}

	// Record response
	span.SetAttributes(
		attribute.Int("http.status_code", resp.StatusCode),
	)

	if resp.StatusCode >= 400 {
		span.SetAttributes(attribute.Bool("error", true))
	}

	return resp, nil
}

// Get performs a traced GET request
func (c *TracedHTTPClient) Get(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(ctx, req)
}

// ServiceSpan creates a span for inter-service communication
func ServiceSpan(ctx context.Context, targetService, operation string) (context.Context, trace.Span) {
	tracer := otel.Tracer("service-client")
	return tracer.Start(ctx, targetService+"."+operation,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("peer.service", targetService),
			attribute.String("rpc.method", operation),
		),
	)
}

// MessageSpan creates a span for message queue operations
func MessageSpan(ctx context.Context, queue, operation string, messageID string) (context.Context, trace.Span) {
	tracer := otel.Tracer("messaging")

	var kind trace.SpanKind
	if operation == "publish" || operation == "send" {
		kind = trace.SpanKindProducer
	} else {
		kind = trace.SpanKindConsumer
	}

	return tracer.Start(ctx, queue+" "+operation,
		trace.WithSpanKind(kind),
		trace.WithAttributes(
			attribute.String("messaging.system", "rabbitmq"),
			attribute.String("messaging.destination", queue),
			attribute.String("messaging.operation", operation),
			attribute.String("messaging.message_id", messageID),
		),
	)
}

// WithTraceID adds trace ID to context for correlation
func WithTraceID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().HasTraceID() {
		return span.SpanContext().TraceID().String()
	}
	return ""
}

// WithSpanID returns the current span ID
func WithSpanID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().HasSpanID() {
		return span.SpanContext().SpanID().String()
	}
	return ""
}

// LinkSpans creates a link between spans (useful for async operations)
func LinkSpans(ctx context.Context, linkedCtx context.Context) trace.Link {
	linkedSpan := trace.SpanFromContext(linkedCtx)
	return trace.Link{
		SpanContext: linkedSpan.SpanContext(),
	}
}

// BusinessSpan creates a span for business operations
func BusinessSpan(ctx context.Context, operation string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	tracer := otel.Tracer("business")
	allAttrs := append([]attribute.KeyValue{
		attribute.String("business.operation", operation),
	}, attrs...)

	return tracer.Start(ctx, operation,
		trace.WithSpanKind(trace.SpanKindInternal),
		trace.WithAttributes(allAttrs...),
	)
}

// OrderSpan creates a span for order-related operations
func OrderSpan(ctx context.Context, operation, orderID string) (context.Context, trace.Span) {
	return BusinessSpan(ctx, "order."+operation,
		attribute.String("order.id", orderID),
	)
}

// PaymentSpan creates a span for payment-related operations
func PaymentSpan(ctx context.Context, operation, provider string, amount float64) (context.Context, trace.Span) {
	return BusinessSpan(ctx, "payment."+operation,
		attribute.String("payment.provider", provider),
		attribute.Float64("payment.amount", amount),
	)
}

// InventorySpan creates a span for inventory-related operations
func InventorySpan(ctx context.Context, operation, productID string, quantity int) (context.Context, trace.Span) {
	return BusinessSpan(ctx, "inventory."+operation,
		attribute.String("product.id", productID),
		attribute.Int("inventory.quantity", quantity),
	)
}
