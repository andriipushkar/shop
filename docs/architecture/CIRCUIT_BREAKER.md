# Circuit Breaker Pattern

Реалізація патерну Circuit Breaker для підвищення відмовостійкості системи при роботі з зовнішніми сервісами.

## Огляд

```
                    Circuit Breaker States
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ┌──────────┐     failure threshold    ┌──────────┐           │
│   │  CLOSED  │ ─────────────────────────►│   OPEN   │           │
│   │ (normal) │                           │ (failing)│           │
│   └────┬─────┘                           └────┬─────┘           │
│        │                                      │                 │
│        │ success                              │ timeout         │
│        │                                      │                 │
│        │         ┌───────────────┐           │                 │
│        │         │  HALF-OPEN    │◄──────────┘                 │
│        └─────────│  (testing)    │                              │
│                  └───────┬───────┘                              │
│                          │                                       │
│                failure   │   success                            │
│                    │     │     │                                │
│                    ▼     │     ▼                                │
│                 ┌──────┐ │ ┌──────┐                             │
│                 │ OPEN │◄┘ │CLOSED│                             │
│                 └──────┘   └──────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Імплементація

### Circuit Breaker Core

```go
// internal/circuitbreaker/breaker.go
package circuitbreaker

import (
    "context"
    "errors"
    "sync"
    "time"
)

type State int

const (
    StateClosed   State = iota // Normal operation
    StateOpen                  // Failing, reject requests
    StateHalfOpen              // Testing if service recovered
)

func (s State) String() string {
    switch s {
    case StateClosed:
        return "closed"
    case StateOpen:
        return "open"
    case StateHalfOpen:
        return "half-open"
    default:
        return "unknown"
    }
}

var (
    ErrCircuitOpen     = errors.New("circuit breaker is open")
    ErrTooManyRequests = errors.New("too many requests in half-open state")
)

type Config struct {
    // Name identifies the circuit breaker
    Name string

    // Thresholds
    FailureThreshold   int     // Number of failures to trip the circuit
    SuccessThreshold   int     // Number of successes to close the circuit
    FailureRateThreshold float64 // Failure rate threshold (0.0 - 1.0)

    // Timeouts
    Timeout        time.Duration // Time before attempting to recover
    HalfOpenMaxReqs int          // Max requests allowed in half-open state

    // Sliding window
    WindowSize     time.Duration // Time window for failure counting
    WindowBuckets  int           // Number of buckets in sliding window

    // Callbacks
    OnStateChange  func(name string, from, to State)
    OnSuccess      func(name string, duration time.Duration)
    OnFailure      func(name string, err error)
}

var DefaultConfig = Config{
    FailureThreshold:     5,
    SuccessThreshold:     3,
    FailureRateThreshold: 0.5,
    Timeout:              30 * time.Second,
    HalfOpenMaxReqs:      3,
    WindowSize:           60 * time.Second,
    WindowBuckets:        10,
}

type CircuitBreaker struct {
    config Config

    mu            sync.RWMutex
    state         State
    failures      int
    successes     int
    consecutiveFails int
    lastFailure   time.Time
    openedAt      time.Time
    halfOpenReqs  int

    // Sliding window
    window        *SlidingWindow
}

func New(config Config) *CircuitBreaker {
    if config.FailureThreshold == 0 {
        config.FailureThreshold = DefaultConfig.FailureThreshold
    }
    if config.SuccessThreshold == 0 {
        config.SuccessThreshold = DefaultConfig.SuccessThreshold
    }
    if config.Timeout == 0 {
        config.Timeout = DefaultConfig.Timeout
    }
    if config.HalfOpenMaxReqs == 0 {
        config.HalfOpenMaxReqs = DefaultConfig.HalfOpenMaxReqs
    }
    if config.WindowSize == 0 {
        config.WindowSize = DefaultConfig.WindowSize
    }
    if config.WindowBuckets == 0 {
        config.WindowBuckets = DefaultConfig.WindowBuckets
    }

    return &CircuitBreaker{
        config: config,
        state:  StateClosed,
        window: NewSlidingWindow(config.WindowSize, config.WindowBuckets),
    }
}

// Execute executes the given function with circuit breaker protection
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func(ctx context.Context) error) error {
    if !cb.AllowRequest() {
        return ErrCircuitOpen
    }

    start := time.Now()
    err := fn(ctx)
    duration := time.Since(start)

    if err != nil {
        cb.RecordFailure(err)
        return err
    }

    cb.RecordSuccess(duration)
    return nil
}

// AllowRequest checks if a request should be allowed
func (cb *CircuitBreaker) AllowRequest() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    switch cb.state {
    case StateClosed:
        return true

    case StateOpen:
        // Check if timeout has passed
        if time.Since(cb.openedAt) > cb.config.Timeout {
            cb.transitionTo(StateHalfOpen)
            cb.halfOpenReqs = 1
            return true
        }
        return false

    case StateHalfOpen:
        if cb.halfOpenReqs < cb.config.HalfOpenMaxReqs {
            cb.halfOpenReqs++
            return true
        }
        return false
    }

    return false
}

// RecordSuccess records a successful call
func (cb *CircuitBreaker) RecordSuccess(duration time.Duration) {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    cb.window.RecordSuccess()
    cb.consecutiveFails = 0

    if cb.config.OnSuccess != nil {
        cb.config.OnSuccess(cb.config.Name, duration)
    }

    switch cb.state {
    case StateHalfOpen:
        cb.successes++
        if cb.successes >= cb.config.SuccessThreshold {
            cb.transitionTo(StateClosed)
        }
    }
}

// RecordFailure records a failed call
func (cb *CircuitBreaker) RecordFailure(err error) {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    cb.window.RecordFailure()
    cb.failures++
    cb.consecutiveFails++
    cb.lastFailure = time.Now()

    if cb.config.OnFailure != nil {
        cb.config.OnFailure(cb.config.Name, err)
    }

    switch cb.state {
    case StateClosed:
        // Check if we should open the circuit
        if cb.shouldOpen() {
            cb.transitionTo(StateOpen)
        }

    case StateHalfOpen:
        // Any failure in half-open state opens the circuit
        cb.transitionTo(StateOpen)
    }
}

func (cb *CircuitBreaker) shouldOpen() bool {
    // Check consecutive failures
    if cb.consecutiveFails >= cb.config.FailureThreshold {
        return true
    }

    // Check failure rate
    if cb.config.FailureRateThreshold > 0 {
        rate := cb.window.FailureRate()
        count := cb.window.TotalCount()
        // Only check rate if we have enough samples
        if count >= cb.config.FailureThreshold && rate >= cb.config.FailureRateThreshold {
            return true
        }
    }

    return false
}

func (cb *CircuitBreaker) transitionTo(state State) {
    from := cb.state
    cb.state = state

    switch state {
    case StateClosed:
        cb.failures = 0
        cb.successes = 0
        cb.consecutiveFails = 0
        cb.window.Reset()

    case StateOpen:
        cb.openedAt = time.Now()

    case StateHalfOpen:
        cb.successes = 0
        cb.halfOpenReqs = 0
    }

    if cb.config.OnStateChange != nil {
        go cb.config.OnStateChange(cb.config.Name, from, state)
    }
}

// State returns the current state
func (cb *CircuitBreaker) State() State {
    cb.mu.RLock()
    defer cb.mu.RUnlock()
    return cb.state
}

// Stats returns circuit breaker statistics
func (cb *CircuitBreaker) Stats() Stats {
    cb.mu.RLock()
    defer cb.mu.RUnlock()

    return Stats{
        State:            cb.state.String(),
        Failures:         cb.failures,
        Successes:        cb.window.SuccessCount(),
        ConsecutiveFails: cb.consecutiveFails,
        FailureRate:      cb.window.FailureRate(),
        LastFailure:      cb.lastFailure,
        OpenedAt:         cb.openedAt,
    }
}

type Stats struct {
    State            string    `json:"state"`
    Failures         int       `json:"failures"`
    Successes        int       `json:"successes"`
    ConsecutiveFails int       `json:"consecutive_failures"`
    FailureRate      float64   `json:"failure_rate"`
    LastFailure      time.Time `json:"last_failure,omitempty"`
    OpenedAt         time.Time `json:"opened_at,omitempty"`
}
```

### Sliding Window

```go
// internal/circuitbreaker/window.go
package circuitbreaker

import (
    "sync"
    "time"
)

type SlidingWindow struct {
    mu         sync.RWMutex
    size       time.Duration
    buckets    []*bucket
    numBuckets int
    current    int
    lastUpdate time.Time
}

type bucket struct {
    successes int
    failures  int
}

func NewSlidingWindow(size time.Duration, numBuckets int) *SlidingWindow {
    buckets := make([]*bucket, numBuckets)
    for i := range buckets {
        buckets[i] = &bucket{}
    }

    return &SlidingWindow{
        size:       size,
        buckets:    buckets,
        numBuckets: numBuckets,
        lastUpdate: time.Now(),
    }
}

func (w *SlidingWindow) bucketDuration() time.Duration {
    return w.size / time.Duration(w.numBuckets)
}

func (w *SlidingWindow) advance() {
    now := time.Now()
    elapsed := now.Sub(w.lastUpdate)
    bucketsToAdvance := int(elapsed / w.bucketDuration())

    if bucketsToAdvance == 0 {
        return
    }

    // Clear old buckets
    for i := 0; i < bucketsToAdvance && i < w.numBuckets; i++ {
        w.current = (w.current + 1) % w.numBuckets
        w.buckets[w.current].successes = 0
        w.buckets[w.current].failures = 0
    }

    w.lastUpdate = now
}

func (w *SlidingWindow) RecordSuccess() {
    w.mu.Lock()
    defer w.mu.Unlock()

    w.advance()
    w.buckets[w.current].successes++
}

func (w *SlidingWindow) RecordFailure() {
    w.mu.Lock()
    defer w.mu.Unlock()

    w.advance()
    w.buckets[w.current].failures++
}

func (w *SlidingWindow) SuccessCount() int {
    w.mu.RLock()
    defer w.mu.RUnlock()

    w.advance()
    count := 0
    for _, b := range w.buckets {
        count += b.successes
    }
    return count
}

func (w *SlidingWindow) FailureCount() int {
    w.mu.RLock()
    defer w.mu.RUnlock()

    w.advance()
    count := 0
    for _, b := range w.buckets {
        count += b.failures
    }
    return count
}

func (w *SlidingWindow) TotalCount() int {
    w.mu.RLock()
    defer w.mu.RUnlock()

    w.advance()
    count := 0
    for _, b := range w.buckets {
        count += b.successes + b.failures
    }
    return count
}

func (w *SlidingWindow) FailureRate() float64 {
    total := w.TotalCount()
    if total == 0 {
        return 0
    }
    return float64(w.FailureCount()) / float64(total)
}

func (w *SlidingWindow) Reset() {
    w.mu.Lock()
    defer w.mu.Unlock()

    for _, b := range w.buckets {
        b.successes = 0
        b.failures = 0
    }
    w.current = 0
    w.lastUpdate = time.Now()
}
```

### Circuit Breaker Registry

```go
// internal/circuitbreaker/registry.go
package circuitbreaker

import (
    "sync"
)

type Registry struct {
    mu       sync.RWMutex
    breakers map[string]*CircuitBreaker
    config   Config
}

func NewRegistry(defaultConfig Config) *Registry {
    return &Registry{
        breakers: make(map[string]*CircuitBreaker),
        config:   defaultConfig,
    }
}

// Get returns a circuit breaker by name, creating one if it doesn't exist
func (r *Registry) Get(name string) *CircuitBreaker {
    r.mu.RLock()
    cb, ok := r.breakers[name]
    r.mu.RUnlock()

    if ok {
        return cb
    }

    r.mu.Lock()
    defer r.mu.Unlock()

    // Double-check after acquiring write lock
    if cb, ok = r.breakers[name]; ok {
        return cb
    }

    config := r.config
    config.Name = name
    cb = New(config)
    r.breakers[name] = cb

    return cb
}

// GetOrCreate returns a circuit breaker with custom config
func (r *Registry) GetOrCreate(name string, config Config) *CircuitBreaker {
    r.mu.RLock()
    cb, ok := r.breakers[name]
    r.mu.RUnlock()

    if ok {
        return cb
    }

    r.mu.Lock()
    defer r.mu.Unlock()

    if cb, ok = r.breakers[name]; ok {
        return cb
    }

    config.Name = name
    cb = New(config)
    r.breakers[name] = cb

    return cb
}

// Stats returns stats for all circuit breakers
func (r *Registry) Stats() map[string]Stats {
    r.mu.RLock()
    defer r.mu.RUnlock()

    stats := make(map[string]Stats)
    for name, cb := range r.breakers {
        stats[name] = cb.Stats()
    }
    return stats
}

// Reset resets all circuit breakers
func (r *Registry) Reset() {
    r.mu.Lock()
    defer r.mu.Unlock()

    for _, cb := range r.breakers {
        cb.mu.Lock()
        cb.transitionTo(StateClosed)
        cb.mu.Unlock()
    }
}
```

## HTTP Client with Circuit Breaker

```go
// internal/http/client.go
package http

import (
    "context"
    "fmt"
    "io"
    "net/http"
    "time"

    "github.com/your-org/shop/internal/circuitbreaker"
)

type Client struct {
    client   *http.Client
    registry *circuitbreaker.Registry
}

func NewClient(timeout time.Duration, registry *circuitbreaker.Registry) *Client {
    return &Client{
        client: &http.Client{
            Timeout: timeout,
        },
        registry: registry,
    }
}

// Do executes an HTTP request with circuit breaker protection
func (c *Client) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
    // Use host as circuit breaker name
    cbName := fmt.Sprintf("http:%s", req.URL.Host)
    cb := c.registry.Get(cbName)

    var resp *http.Response
    err := cb.Execute(ctx, func(ctx context.Context) error {
        req = req.WithContext(ctx)

        var err error
        resp, err = c.client.Do(req)
        if err != nil {
            return err
        }

        // Treat 5xx responses as failures
        if resp.StatusCode >= 500 {
            body, _ := io.ReadAll(resp.Body)
            resp.Body.Close()
            return fmt.Errorf("server error: %d %s", resp.StatusCode, string(body))
        }

        return nil
    })

    return resp, err
}

// Get performs a GET request with circuit breaker protection
func (c *Client) Get(ctx context.Context, url string) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }
    return c.Do(ctx, req)
}

// Post performs a POST request with circuit breaker protection
func (c *Client) Post(ctx context.Context, url string, contentType string, body io.Reader) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "POST", url, body)
    if err != nil {
        return nil, err
    }
    req.Header.Set("Content-Type", contentType)
    return c.Do(ctx, req)
}
```

## Integration Example: Payment Gateway

```go
// internal/payment/gateway.go
package payment

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"

    "github.com/your-org/shop/internal/circuitbreaker"
)

type PaymentGateway struct {
    baseURL  string
    apiKey   string
    client   *http.Client
    cb       *circuitbreaker.CircuitBreaker
}

func NewPaymentGateway(baseURL, apiKey string, registry *circuitbreaker.Registry) *PaymentGateway {
    // Custom config for payment gateway - more sensitive
    cb := registry.GetOrCreate("payment-gateway", circuitbreaker.Config{
        Name:               "payment-gateway",
        FailureThreshold:   3,
        SuccessThreshold:   2,
        FailureRateThreshold: 0.3,
        Timeout:            60 * time.Second, // Longer timeout for payment recovery
        HalfOpenMaxReqs:    1,
        WindowSize:         30 * time.Second,
        OnStateChange: func(name string, from, to circuitbreaker.State) {
            log.Printf("Payment gateway circuit breaker: %s -> %s", from, to)
            if to == circuitbreaker.StateOpen {
                // Alert operations team
                alerting.SendCritical("Payment gateway circuit breaker opened")
            }
        },
    })

    return &PaymentGateway{
        baseURL: baseURL,
        apiKey:  apiKey,
        client:  &http.Client{Timeout: 30 * time.Second},
        cb:      cb,
    }
}

func (g *PaymentGateway) Charge(ctx context.Context, req *ChargeRequest) (*ChargeResponse, error) {
    var result *ChargeResponse

    err := g.cb.Execute(ctx, func(ctx context.Context) error {
        // Build request
        body, _ := json.Marshal(req)
        httpReq, _ := http.NewRequestWithContext(ctx, "POST", g.baseURL+"/charge", bytes.NewReader(body))
        httpReq.Header.Set("Authorization", "Bearer "+g.apiKey)
        httpReq.Header.Set("Content-Type", "application/json")

        // Execute
        resp, err := g.client.Do(httpReq)
        if err != nil {
            return fmt.Errorf("request failed: %w", err)
        }
        defer resp.Body.Close()

        // Check status
        if resp.StatusCode >= 500 {
            return fmt.Errorf("gateway error: %d", resp.StatusCode)
        }

        if resp.StatusCode >= 400 {
            // Client errors don't trip the circuit
            var errResp ErrorResponse
            json.NewDecoder(resp.Body).Decode(&errResp)
            return &PaymentError{
                Code:    errResp.Code,
                Message: errResp.Message,
            }
        }

        // Parse response
        result = &ChargeResponse{}
        return json.NewDecoder(resp.Body).Decode(result)
    })

    if err != nil {
        // Check if circuit is open
        if err == circuitbreaker.ErrCircuitOpen {
            return nil, &PaymentError{
                Code:    "GATEWAY_UNAVAILABLE",
                Message: "Payment gateway is temporarily unavailable. Please try again later.",
            }
        }
        return nil, err
    }

    return result, nil
}

// PaymentError is a client error that shouldn't trip the circuit
type PaymentError struct {
    Code    string
    Message string
}

func (e *PaymentError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// IsPaymentError checks if error is a client-side payment error
func IsPaymentError(err error) bool {
    _, ok := err.(*PaymentError)
    return ok
}
```

## Middleware for HTTP Server

```go
// internal/middleware/circuitbreaker.go
package middleware

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/your-org/shop/internal/circuitbreaker"
)

// CircuitBreakerMiddleware protects downstream services
func CircuitBreakerMiddleware(registry *circuitbreaker.Registry) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Get circuit breaker for the route
        cbName := fmt.Sprintf("route:%s:%s", c.Request.Method, c.FullPath())
        cb := registry.Get(cbName)

        // Check if circuit is open
        if !cb.AllowRequest() {
            c.JSON(http.StatusServiceUnavailable, gin.H{
                "error":   "Service temporarily unavailable",
                "retry_after": 30,
            })
            c.Abort()
            return
        }

        // Record success/failure based on response
        c.Next()

        if c.Writer.Status() >= 500 {
            cb.RecordFailure(fmt.Errorf("status %d", c.Writer.Status()))
        } else {
            cb.RecordSuccess(time.Since(time.Now()))
        }
    }
}

// CircuitBreakerStats returns stats endpoint
func CircuitBreakerStats(registry *circuitbreaker.Registry) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.JSON(http.StatusOK, registry.Stats())
    }
}
```

## Prometheus Metrics

```go
// internal/circuitbreaker/metrics.go
package circuitbreaker

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    stateGauge = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "circuit_breaker_state",
            Help: "Current state of circuit breaker (0=closed, 1=open, 2=half-open)",
        },
        []string{"name"},
    )

    requestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "circuit_breaker_requests_total",
            Help: "Total number of requests through circuit breaker",
        },
        []string{"name", "result"},
    )

    failureRate = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "circuit_breaker_failure_rate",
            Help: "Current failure rate of circuit breaker",
        },
        []string{"name"},
    )

    stateTransitions = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "circuit_breaker_state_transitions_total",
            Help: "Total number of state transitions",
        },
        []string{"name", "from", "to"},
    )
)

// MetricsConfig returns a Config with metrics callbacks
func MetricsConfig(name string) Config {
    return Config{
        Name: name,
        OnStateChange: func(name string, from, to State) {
            stateGauge.WithLabelValues(name).Set(float64(to))
            stateTransitions.WithLabelValues(name, from.String(), to.String()).Inc()
        },
        OnSuccess: func(name string, duration time.Duration) {
            requestsTotal.WithLabelValues(name, "success").Inc()
        },
        OnFailure: func(name string, err error) {
            requestsTotal.WithLabelValues(name, "failure").Inc()
        },
    }
}

// UpdateMetrics updates metrics for a circuit breaker
func UpdateMetrics(cb *CircuitBreaker) {
    stats := cb.Stats()
    failureRate.WithLabelValues(cb.config.Name).Set(stats.FailureRate)
}
```

## Configuration

```yaml
# config/circuit_breaker.yaml
circuit_breaker:
  default:
    failure_threshold: 5
    success_threshold: 3
    failure_rate_threshold: 0.5
    timeout: 30s
    half_open_max_requests: 3
    window_size: 60s
    window_buckets: 10

  services:
    payment-gateway:
      failure_threshold: 3
      success_threshold: 2
      failure_rate_threshold: 0.3
      timeout: 60s
      half_open_max_requests: 1

    nova-poshta:
      failure_threshold: 5
      success_threshold: 3
      timeout: 30s

    email-service:
      failure_threshold: 10
      success_threshold: 5
      timeout: 120s

    elasticsearch:
      failure_threshold: 3
      success_threshold: 2
      timeout: 15s
```

## Тестування

```go
// internal/circuitbreaker/breaker_test.go
package circuitbreaker

import (
    "context"
    "errors"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
)

func TestCircuitBreaker_ClosedState(t *testing.T) {
    cb := New(Config{
        FailureThreshold: 3,
        SuccessThreshold: 2,
        Timeout:          100 * time.Millisecond,
    })

    // Should allow requests in closed state
    assert.True(t, cb.AllowRequest())
    assert.Equal(t, StateClosed, cb.State())

    // Record successes
    cb.RecordSuccess(10 * time.Millisecond)
    assert.Equal(t, StateClosed, cb.State())
}

func TestCircuitBreaker_OpensOnFailures(t *testing.T) {
    cb := New(Config{
        FailureThreshold: 3,
        SuccessThreshold: 2,
        Timeout:          100 * time.Millisecond,
    })

    // Record failures to trip the circuit
    for i := 0; i < 3; i++ {
        cb.AllowRequest()
        cb.RecordFailure(errors.New("test error"))
    }

    assert.Equal(t, StateOpen, cb.State())
    assert.False(t, cb.AllowRequest())
}

func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
    cb := New(Config{
        FailureThreshold: 3,
        SuccessThreshold: 2,
        Timeout:          50 * time.Millisecond,
        HalfOpenMaxReqs:  1,
    })

    // Trip the circuit
    for i := 0; i < 3; i++ {
        cb.AllowRequest()
        cb.RecordFailure(errors.New("test error"))
    }

    assert.Equal(t, StateOpen, cb.State())

    // Wait for timeout
    time.Sleep(60 * time.Millisecond)

    // Should transition to half-open
    assert.True(t, cb.AllowRequest())
    assert.Equal(t, StateHalfOpen, cb.State())
}

func TestCircuitBreaker_ClosesAfterSuccessInHalfOpen(t *testing.T) {
    cb := New(Config{
        FailureThreshold: 3,
        SuccessThreshold: 2,
        Timeout:          50 * time.Millisecond,
        HalfOpenMaxReqs:  2,
    })

    // Trip and wait
    for i := 0; i < 3; i++ {
        cb.AllowRequest()
        cb.RecordFailure(errors.New("test error"))
    }
    time.Sleep(60 * time.Millisecond)

    // Record successes in half-open
    cb.AllowRequest()
    cb.RecordSuccess(10 * time.Millisecond)
    assert.Equal(t, StateHalfOpen, cb.State())

    cb.AllowRequest()
    cb.RecordSuccess(10 * time.Millisecond)
    assert.Equal(t, StateClosed, cb.State())
}

func TestCircuitBreaker_Execute(t *testing.T) {
    cb := New(Config{
        FailureThreshold: 2,
        Timeout:          100 * time.Millisecond,
    })

    // Successful execution
    err := cb.Execute(context.Background(), func(ctx context.Context) error {
        return nil
    })
    assert.NoError(t, err)

    // Failed executions
    for i := 0; i < 2; i++ {
        cb.Execute(context.Background(), func(ctx context.Context) error {
            return errors.New("test error")
        })
    }

    // Circuit should be open
    err = cb.Execute(context.Background(), func(ctx context.Context) error {
        return nil
    })
    assert.Equal(t, ErrCircuitOpen, err)
}

func TestSlidingWindow_FailureRate(t *testing.T) {
    window := NewSlidingWindow(time.Minute, 10)

    // Record some successes and failures
    for i := 0; i < 7; i++ {
        window.RecordSuccess()
    }
    for i := 0; i < 3; i++ {
        window.RecordFailure()
    }

    // Should be 30% failure rate
    rate := window.FailureRate()
    assert.InDelta(t, 0.3, rate, 0.01)
}
```

## Grafana Dashboard

```json
{
  "title": "Circuit Breakers",
  "panels": [
    {
      "title": "Circuit Breaker States",
      "type": "stat",
      "targets": [
        {
          "expr": "circuit_breaker_state",
          "legendFormat": "{{name}}"
        }
      ],
      "mappings": [
        {"value": 0, "text": "Closed", "color": "green"},
        {"value": 1, "text": "Open", "color": "red"},
        {"value": 2, "text": "Half-Open", "color": "yellow"}
      ]
    },
    {
      "title": "Failure Rate",
      "type": "gauge",
      "targets": [
        {
          "expr": "circuit_breaker_failure_rate",
          "legendFormat": "{{name}}"
        }
      ],
      "thresholds": [
        {"value": 0, "color": "green"},
        {"value": 0.3, "color": "yellow"},
        {"value": 0.5, "color": "red"}
      ]
    },
    {
      "title": "Requests per Second",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(circuit_breaker_requests_total[5m])",
          "legendFormat": "{{name}} - {{result}}"
        }
      ]
    },
    {
      "title": "State Transitions",
      "type": "graph",
      "targets": [
        {
          "expr": "increase(circuit_breaker_state_transitions_total[1h])",
          "legendFormat": "{{name}}: {{from}} -> {{to}}"
        }
      ]
    }
  ]
}
```

## Див. також

- [Rate Limiting](./RATE_LIMITING.md)
- [Monitoring](../infrastructure/MONITORING.md)
- [Error Handling](./ERROR_HANDLING.md)
