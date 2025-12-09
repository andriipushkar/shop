package circuitbreaker

import (
	"errors"
	"net/http"
	"time"

	"github.com/sony/gobreaker"
)

var (
	ErrCircuitOpen = errors.New("circuit breaker is open")
)

// Config holds circuit breaker configuration
type Config struct {
	Name          string
	MaxRequests   uint32        // Max requests in half-open state
	Interval      time.Duration // Cyclic period for clearing counts (0 = never clears)
	Timeout       time.Duration // Period of open state before half-open
	FailureRatio  float64       // Failure ratio to trip the breaker
	MinRequests   uint32        // Minimum requests before ratio is checked
}

// DefaultConfig returns default circuit breaker configuration
func DefaultConfig(name string) Config {
	return Config{
		Name:         name,
		MaxRequests:  3,
		Interval:     10 * time.Second,
		Timeout:      30 * time.Second,
		FailureRatio: 0.6,
		MinRequests:  5,
	}
}

// Breaker wraps gobreaker.CircuitBreaker with additional functionality
type Breaker struct {
	cb *gobreaker.CircuitBreaker
}

// New creates a new circuit breaker
func New(cfg Config) *Breaker {
	settings := gobreaker.Settings{
		Name:        cfg.Name,
		MaxRequests: cfg.MaxRequests,
		Interval:    cfg.Interval,
		Timeout:     cfg.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			if counts.Requests < cfg.MinRequests {
				return false
			}
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return failureRatio >= cfg.FailureRatio
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			// Could add logging or metrics here
		},
	}

	return &Breaker{
		cb: gobreaker.NewCircuitBreaker(settings),
	}
}

// Execute runs the given function with circuit breaker protection
func (b *Breaker) Execute(fn func() (interface{}, error)) (interface{}, error) {
	return b.cb.Execute(fn)
}

// State returns the current state of the circuit breaker
func (b *Breaker) State() gobreaker.State {
	return b.cb.State()
}

// Counts returns the current counts
func (b *Breaker) Counts() gobreaker.Counts {
	return b.cb.Counts()
}

// HTTPClient wraps an HTTP client with circuit breaker
type HTTPClient struct {
	client  *http.Client
	breaker *Breaker
}

// NewHTTPClient creates an HTTP client with circuit breaker
func NewHTTPClient(cfg Config, timeout time.Duration) *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: timeout,
		},
		breaker: New(cfg),
	}
}

// Do executes an HTTP request with circuit breaker protection
func (c *HTTPClient) Do(req *http.Request) (*http.Response, error) {
	result, err := c.breaker.Execute(func() (interface{}, error) {
		resp, err := c.client.Do(req)
		if err != nil {
			return nil, err
		}
		// Consider 5xx errors as failures
		if resp.StatusCode >= 500 {
			return resp, errors.New("server error")
		}
		return resp, nil
	})

	if err != nil {
		if err == gobreaker.ErrOpenState {
			return nil, ErrCircuitOpen
		}
		// Return the response even if there was an error (e.g., 5xx)
		if result != nil {
			return result.(*http.Response), err
		}
		return nil, err
	}

	return result.(*http.Response), nil
}

// Get performs a GET request with circuit breaker protection
func (c *HTTPClient) Get(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

// State returns the current circuit breaker state
func (c *HTTPClient) State() string {
	switch c.breaker.State() {
	case gobreaker.StateClosed:
		return "closed"
	case gobreaker.StateHalfOpen:
		return "half-open"
	case gobreaker.StateOpen:
		return "open"
	default:
		return "unknown"
	}
}

// Manager manages multiple circuit breakers
type Manager struct {
	breakers map[string]*Breaker
}

// NewManager creates a new circuit breaker manager
func NewManager() *Manager {
	return &Manager{
		breakers: make(map[string]*Breaker),
	}
}

// Get returns a circuit breaker by name, creating one if it doesn't exist
func (m *Manager) Get(name string) *Breaker {
	if b, ok := m.breakers[name]; ok {
		return b
	}
	b := New(DefaultConfig(name))
	m.breakers[name] = b
	return b
}

// GetWithConfig returns a circuit breaker with custom configuration
func (m *Manager) GetWithConfig(cfg Config) *Breaker {
	if b, ok := m.breakers[cfg.Name]; ok {
		return b
	}
	b := New(cfg)
	m.breakers[cfg.Name] = b
	return b
}

// States returns the state of all circuit breakers
func (m *Manager) States() map[string]string {
	states := make(map[string]string)
	for name, b := range m.breakers {
		switch b.State() {
		case gobreaker.StateClosed:
			states[name] = "closed"
		case gobreaker.StateHalfOpen:
			states[name] = "half-open"
		case gobreaker.StateOpen:
			states[name] = "open"
		}
	}
	return states
}
