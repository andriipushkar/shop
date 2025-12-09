package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// GracefulServer wraps http.Server with graceful shutdown
type GracefulServer struct {
	server          *http.Server
	shutdownTimeout time.Duration
	onShutdown      []func(context.Context) error
	wg              sync.WaitGroup
}

// Config holds server configuration
type Config struct {
	Host            string
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// DefaultConfig returns default server configuration
func DefaultConfig() *Config {
	return &Config{
		Host:            "",
		Port:            8080,
		ReadTimeout:     15 * time.Second,
		WriteTimeout:    15 * time.Second,
		IdleTimeout:     60 * time.Second,
		ShutdownTimeout: 30 * time.Second,
	}
}

// New creates a new graceful server
func New(handler http.Handler, config *Config) *GracefulServer {
	if config == nil {
		config = DefaultConfig()
	}

	return &GracefulServer{
		server: &http.Server{
			Addr:         fmt.Sprintf("%s:%d", config.Host, config.Port),
			Handler:      handler,
			ReadTimeout:  config.ReadTimeout,
			WriteTimeout: config.WriteTimeout,
			IdleTimeout:  config.IdleTimeout,
		},
		shutdownTimeout: config.ShutdownTimeout,
		onShutdown:      make([]func(context.Context) error, 0),
	}
}

// OnShutdown registers a shutdown hook
func (s *GracefulServer) OnShutdown(fn func(context.Context) error) {
	s.onShutdown = append(s.onShutdown, fn)
}

// ListenAndServe starts the server and blocks until shutdown
func (s *GracefulServer) ListenAndServe() error {
	// Channel to receive errors from server
	errCh := make(chan error, 1)

	// Start server in goroutine
	go func() {
		fmt.Printf("Server starting on %s\n", s.server.Addr)
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)

	select {
	case err := <-errCh:
		return err
	case sig := <-quit:
		fmt.Printf("\nReceived signal: %v. Shutting down...\n", sig)
	}

	return s.Shutdown()
}

// ListenAndServeTLS starts the server with TLS
func (s *GracefulServer) ListenAndServeTLS(certFile, keyFile string) error {
	errCh := make(chan error, 1)

	go func() {
		fmt.Printf("Server starting on %s (TLS)\n", s.server.Addr)
		if err := s.server.ListenAndServeTLS(certFile, keyFile); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)

	select {
	case err := <-errCh:
		return err
	case sig := <-quit:
		fmt.Printf("\nReceived signal: %v. Shutting down...\n", sig)
	}

	return s.Shutdown()
}

// Shutdown gracefully shuts down the server
func (s *GracefulServer) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
	defer cancel()

	// Run shutdown hooks concurrently
	var wg sync.WaitGroup
	errCh := make(chan error, len(s.onShutdown))

	for _, hook := range s.onShutdown {
		wg.Add(1)
		go func(fn func(context.Context) error) {
			defer wg.Done()
			if err := fn(ctx); err != nil {
				errCh <- err
			}
		}(hook)
	}

	// Wait for hooks to complete
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// All hooks completed
	case <-ctx.Done():
		fmt.Println("Shutdown hooks timed out")
	}

	// Shutdown server
	fmt.Println("Shutting down HTTP server...")
	if err := s.server.Shutdown(ctx); err != nil {
		return fmt.Errorf("server shutdown error: %w", err)
	}

	fmt.Println("Server stopped gracefully")
	return nil
}

// Address returns the server address
func (s *GracefulServer) Address() string {
	return s.server.Addr
}

// HealthCheck creates a health check handler
func HealthCheck(version string, checks ...func() error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "healthy"
		httpStatus := http.StatusOK

		for _, check := range checks {
			if err := check(); err != nil {
				status = "unhealthy"
				httpStatus = http.StatusServiceUnavailable
				break
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		fmt.Fprintf(w, `{"status":"%s","version":"%s","timestamp":"%s"}`,
			status, version, time.Now().UTC().Format(time.RFC3339))
	}
}

// ReadinessCheck creates a readiness check handler
func ReadinessCheck(checks ...func() error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		for _, check := range checks {
			if err := check(); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				fmt.Fprintf(w, `{"ready":false,"error":"%s"}`, err.Error())
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"ready":true}`)
	}
}

// LivenessCheck creates a liveness check handler
func LivenessCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"alive":true}`)
	}
}

// Worker represents a background worker
type Worker struct {
	name     string
	fn       func(context.Context)
	interval time.Duration
}

// WorkerPool manages background workers
type WorkerPool struct {
	workers  []*Worker
	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	started  bool
	mu       sync.Mutex
}

// NewWorkerPool creates a new worker pool
func NewWorkerPool() *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerPool{
		workers: make([]*Worker, 0),
		ctx:     ctx,
		cancel:  cancel,
	}
}

// AddWorker adds a worker to the pool
func (p *WorkerPool) AddWorker(name string, fn func(context.Context), interval time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.workers = append(p.workers, &Worker{
		name:     name,
		fn:       fn,
		interval: interval,
	})
}

// Start starts all workers
func (p *WorkerPool) Start() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.started {
		return
	}
	p.started = true

	for _, worker := range p.workers {
		p.wg.Add(1)
		go func(w *Worker) {
			defer p.wg.Done()

			ticker := time.NewTicker(w.interval)
			defer ticker.Stop()

			// Run immediately
			w.fn(p.ctx)

			for {
				select {
				case <-p.ctx.Done():
					fmt.Printf("Worker %s stopping\n", w.name)
					return
				case <-ticker.C:
					w.fn(p.ctx)
				}
			}
		}(worker)
	}
}

// Stop stops all workers
func (p *WorkerPool) Stop() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.started {
		return
	}

	p.cancel()
	p.wg.Wait()
	p.started = false
}

// ShutdownHook returns a shutdown hook for the worker pool
func (p *WorkerPool) ShutdownHook() func(context.Context) error {
	return func(ctx context.Context) error {
		p.Stop()
		return nil
	}
}
