package inventory

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// ============================================================================
// Mock Repository
// ============================================================================

type mockRepository struct {
	mu              sync.RWMutex
	products        map[string]*Product
	syncResults     []*SyncResult
	outOfSync       []*Product
	getProductErr   error
	updateErr       error
	bulkUpdateErr   error
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		products:    make(map[string]*Product),
		syncResults: make([]*SyncResult, 0),
		outOfSync:   make([]*Product, 0),
	}
}

func (r *mockRepository) GetProductBySKU(ctx context.Context, sku string) (*Product, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.getProductErr != nil {
		return nil, r.getProductErr
	}
	p, ok := r.products[sku]
	if !ok {
		return nil, ErrProductNotFound
	}
	return p, nil
}

func (r *mockRepository) UpdateInventory(ctx context.Context, sku string, quantity int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.updateErr != nil {
		return r.updateErr
	}
	if p, ok := r.products[sku]; ok {
		p.Quantity = quantity
		p.LastUpdated = time.Now()
	}
	return nil
}

func (r *mockRepository) UpdatePrice(ctx context.Context, sku string, price float64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.updateErr != nil {
		return r.updateErr
	}
	if p, ok := r.products[sku]; ok {
		p.Price = price
	}
	return nil
}

func (r *mockRepository) BulkUpdateInventory(ctx context.Context, products []*Product) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.bulkUpdateErr != nil {
		return r.bulkUpdateErr
	}
	for _, p := range products {
		r.products[p.SKU] = p
	}
	return nil
}

func (r *mockRepository) GetOutOfSyncProducts(ctx context.Context, since time.Time) ([]*Product, error) {
	return r.outOfSync, nil
}

func (r *mockRepository) SaveSyncResult(ctx context.Context, result *SyncResult) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.syncResults = append(r.syncResults, result)
	return nil
}

func (r *mockRepository) GetLastSyncResult(ctx context.Context) (*SyncResult, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.syncResults) == 0 {
		return nil, nil
	}
	return r.syncResults[len(r.syncResults)-1], nil
}

// ============================================================================
// Mock ERP Client
// ============================================================================

type mockERPClient struct {
	connected     bool
	products      []*Product
	connectErr    error
	getProductErr error
	updateErr     error
}

func newMockERPClient() *mockERPClient {
	return &mockERPClient{
		products: make([]*Product, 0),
	}
}

func (c *mockERPClient) Connect(ctx context.Context) error {
	if c.connectErr != nil {
		return c.connectErr
	}
	c.connected = true
	return nil
}

func (c *mockERPClient) Close() error {
	c.connected = false
	return nil
}

func (c *mockERPClient) GetProducts(ctx context.Context, since time.Time) ([]*Product, error) {
	if c.getProductErr != nil {
		return nil, c.getProductErr
	}
	return c.products, nil
}

func (c *mockERPClient) GetProduct(ctx context.Context, sku string) (*Product, error) {
	if c.getProductErr != nil {
		return nil, c.getProductErr
	}
	for _, p := range c.products {
		if p.SKU == sku {
			return p, nil
		}
	}
	return nil, ErrProductNotFound
}

func (c *mockERPClient) UpdateStock(ctx context.Context, sku string, quantity int) error {
	if c.updateErr != nil {
		return c.updateErr
	}
	for _, p := range c.products {
		if p.SKU == sku {
			p.Quantity = quantity
			return nil
		}
	}
	return ErrProductNotFound
}

// ============================================================================
// Config Tests
// ============================================================================

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()

	if config.ERPType != ERP1C {
		t.Errorf("expected ERP type '1c', got '%s'", config.ERPType)
	}
	if config.SyncInterval != 15*time.Minute {
		t.Errorf("expected sync interval 15m, got %v", config.SyncInterval)
	}
	if config.BatchSize != 100 {
		t.Errorf("expected batch size 100, got %d", config.BatchSize)
	}
	if config.Timeout != 30*time.Second {
		t.Errorf("expected timeout 30s, got %v", config.Timeout)
	}
	if config.RetryAttempts != 3 {
		t.Errorf("expected retry attempts 3, got %d", config.RetryAttempts)
	}
}

func TestConfigStruct(t *testing.T) {
	config := &Config{
		ERPType:       ERPOdoo,
		BaseURL:       "https://erp.example.com",
		Username:      "admin",
		Password:      "secret",
		APIKey:        "api-key-123",
		SyncInterval:  5 * time.Minute,
		BatchSize:     50,
		Timeout:       60 * time.Second,
		RetryAttempts: 5,
	}

	if config.ERPType != ERPOdoo {
		t.Errorf("expected ERP type 'odoo', got '%s'", config.ERPType)
	}
}

// ============================================================================
// Service Tests
// ============================================================================

func TestNewService(t *testing.T) {
	repo := newMockRepository()
	config := DefaultConfig()

	service := NewService(repo, config)

	if service == nil {
		t.Fatal("expected service to be created")
	}
	if service.repo != repo {
		t.Error("expected repo to be set")
	}
	if service.config != config {
		t.Error("expected config to be set")
	}
}

func TestSetClient(t *testing.T) {
	repo := newMockRepository()
	config := DefaultConfig()
	service := NewService(repo, config)
	client := newMockERPClient()

	service.SetClient(client)

	if service.client != client {
		t.Error("expected client to be set")
	}
}

func TestSyncNow(t *testing.T) {
	t.Run("without client", func(t *testing.T) {
		repo := newMockRepository()
		config := DefaultConfig()
		service := NewService(repo, config)

		ctx := context.Background()
		_, err := service.SyncNow(ctx, SyncDirectionPull)
		if err == nil {
			t.Error("expected error when client is not configured")
		}
	})

	t.Run("connection error", func(t *testing.T) {
		repo := newMockRepository()
		config := DefaultConfig()
		service := NewService(repo, config)
		client := newMockERPClient()
		client.connectErr = errors.New("connection refused")
		service.SetClient(client)

		ctx := context.Background()
		result, err := service.SyncNow(ctx, SyncDirectionPull)

		if err != ErrConnectionError {
			t.Errorf("expected ErrConnectionError, got %v", err)
		}
		if result.Status != SyncStatusFailed {
			t.Errorf("expected status 'failed', got '%s'", result.Status)
		}
	})

	t.Run("successful pull sync", func(t *testing.T) {
		repo := newMockRepository()
		config := DefaultConfig()
		config.BatchSize = 10
		service := NewService(repo, config)
		client := newMockERPClient()
		client.products = []*Product{
			{SKU: "SKU001", Name: "Product 1", Quantity: 10, Price: 100.0},
			{SKU: "SKU002", Name: "Product 2", Quantity: 20, Price: 200.0},
		}
		service.SetClient(client)

		ctx := context.Background()
		result, err := service.SyncNow(ctx, SyncDirectionPull)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Status != SyncStatusCompleted {
			t.Errorf("expected status 'completed', got '%s'", result.Status)
		}
		if result.TotalItems != 2 {
			t.Errorf("expected 2 total items, got %d", result.TotalItems)
		}
		if result.SyncedItems != 2 {
			t.Errorf("expected 2 synced items, got %d", result.SyncedItems)
		}
	})

	t.Run("successful push sync", func(t *testing.T) {
		repo := newMockRepository()
		repo.outOfSync = []*Product{
			{SKU: "SKU001", Quantity: 15},
			{SKU: "SKU002", Quantity: 25},
		}
		config := DefaultConfig()
		service := NewService(repo, config)
		client := newMockERPClient()
		client.products = []*Product{
			{SKU: "SKU001", Quantity: 10},
			{SKU: "SKU002", Quantity: 20},
		}
		service.SetClient(client)

		ctx := context.Background()
		result, err := service.SyncNow(ctx, SyncDirectionPush)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Status != SyncStatusCompleted {
			t.Errorf("expected status 'completed', got '%s'", result.Status)
		}
	})

	t.Run("both directions sync", func(t *testing.T) {
		repo := newMockRepository()
		config := DefaultConfig()
		service := NewService(repo, config)
		client := newMockERPClient()
		service.SetClient(client)

		ctx := context.Background()
		result, err := service.SyncNow(ctx, SyncDirectionBoth)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Direction != SyncDirectionBoth {
			t.Errorf("expected direction 'both', got '%s'", result.Direction)
		}
	})

	t.Run("with bulk update error", func(t *testing.T) {
		repo := newMockRepository()
		repo.bulkUpdateErr = errors.New("bulk update failed")
		config := DefaultConfig()
		service := NewService(repo, config)
		client := newMockERPClient()
		client.products = []*Product{
			{SKU: "SKU001", Quantity: 10},
		}
		service.SetClient(client)

		ctx := context.Background()
		result, _ := service.SyncNow(ctx, SyncDirectionPull)

		if result.FailedItems != 1 {
			t.Errorf("expected 1 failed item, got %d", result.FailedItems)
		}
		if len(result.Errors) == 0 {
			t.Error("expected errors to be recorded")
		}
	})
}

func TestStartStop(t *testing.T) {
	repo := newMockRepository()
	config := DefaultConfig()
	config.SyncInterval = 50 * time.Millisecond
	service := NewService(repo, config)
	client := newMockERPClient()
	service.SetClient(client)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err := service.Start(ctx)
	if err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	// Try to start again
	err = service.Start(ctx)
	if err != nil {
		t.Fatalf("second start should not error: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	service.Stop()
	service.Stop() // Should be safe to call twice

	// Check that syncs happened
	lastResult, err := repo.GetLastSyncResult(ctx)
	if err != nil {
		t.Fatalf("failed to get last result: %v", err)
	}
	if lastResult == nil {
		t.Error("expected at least one sync to have happened")
	}
}

func TestGetSyncStatus(t *testing.T) {
	repo := newMockRepository()
	config := DefaultConfig()
	service := NewService(repo, config)

	ctx := context.Background()

	t.Run("no previous sync", func(t *testing.T) {
		result, err := service.GetSyncStatus(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result != nil {
			t.Error("expected nil for no previous sync")
		}
	})

	t.Run("with previous sync", func(t *testing.T) {
		client := newMockERPClient()
		service.SetClient(client)
		service.SyncNow(ctx, SyncDirectionPull)

		result, err := service.GetSyncStatus(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result == nil {
			t.Error("expected result for previous sync")
		}
	})
}

// ============================================================================
// 1C Client Tests
// ============================================================================

func TestNewOneCClient(t *testing.T) {
	config := &Config{
		BaseURL:  "https://erp.example.com",
		Username: "admin",
		Password: "secret",
		Timeout:  30 * time.Second,
	}

	client := NewOneCClient(config)

	if client == nil {
		t.Fatal("expected client to be created")
	}
	if client.config != config {
		t.Error("expected config to be set")
	}
	if client.httpClient == nil {
		t.Error("expected httpClient to be set")
	}
}

func TestOneCConnect(t *testing.T) {
	t.Run("successful connection", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/ping" {
				t.Errorf("expected path '/ping', got '%s'", r.URL.Path)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		config := &Config{
			BaseURL:  server.URL,
			Username: "admin",
			Password: "secret",
			Timeout:  5 * time.Second,
		}
		client := NewOneCClient(config)

		ctx := context.Background()
		err := client.Connect(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("connection failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer server.Close()

		config := &Config{
			BaseURL: server.URL,
			Timeout: 5 * time.Second,
		}
		client := NewOneCClient(config)

		ctx := context.Background()
		err := client.Connect(ctx)
		if err != ErrConnectionError {
			t.Errorf("expected ErrConnectionError, got %v", err)
		}
	})
}

func TestOneCGetProducts(t *testing.T) {
	t.Run("xml response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/xml")
			w.Write([]byte(`<?xml version="1.0"?>
				<root>
					<Product>
						<SKU>SKU001</SKU>
						<Name>Product 1</Name>
						<Quantity>10</Quantity>
						<Price>100.00</Price>
					</Product>
				</root>`))
		}))
		defer server.Close()

		config := &Config{
			BaseURL:  server.URL,
			Username: "admin",
			Password: "secret",
			Timeout:  5 * time.Second,
		}
		client := NewOneCClient(config)

		ctx := context.Background()
		products, err := client.GetProducts(ctx, time.Now().Add(-24*time.Hour))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(products) != 1 {
			t.Errorf("expected 1 product, got %d", len(products))
		}
	})

	t.Run("json response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"products": []map[string]interface{}{
					{"sku": "SKU001", "name": "Product 1", "quantity": 10, "price": 100.0},
					{"sku": "SKU002", "name": "Product 2", "quantity": 20, "price": 200.0},
				},
			})
		}))
		defer server.Close()

		config := &Config{
			BaseURL: server.URL,
			Timeout: 5 * time.Second,
		}
		client := NewOneCClient(config)

		ctx := context.Background()
		products, err := client.GetProducts(ctx, time.Now())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(products) != 2 {
			t.Errorf("expected 2 products, got %d", len(products))
		}
	})
}

func TestOneCGetProduct(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(Product{
				SKU:      "SKU001",
				Name:     "Product 1",
				Quantity: 10,
				Price:    100.0,
			})
		}))
		defer server.Close()

		config := &Config{BaseURL: server.URL, Timeout: 5 * time.Second}
		client := NewOneCClient(config)

		ctx := context.Background()
		product, err := client.GetProduct(ctx, "SKU001")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if product.SKU != "SKU001" {
			t.Errorf("expected SKU 'SKU001', got '%s'", product.SKU)
		}
	})

	t.Run("not found", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		config := &Config{BaseURL: server.URL, Timeout: 5 * time.Second}
		client := NewOneCClient(config)

		ctx := context.Background()
		_, err := client.GetProduct(ctx, "NONEXISTENT")
		if err != ErrProductNotFound {
			t.Errorf("expected ErrProductNotFound, got %v", err)
		}
	})
}

func TestOneCUpdateStock(t *testing.T) {
	t.Run("successful update", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				t.Errorf("expected POST, got %s", r.Method)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		config := &Config{BaseURL: server.URL, Timeout: 5 * time.Second}
		client := NewOneCClient(config)

		ctx := context.Background()
		err := client.UpdateStock(ctx, "SKU001", 15)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("update error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
		}))
		defer server.Close()

		config := &Config{BaseURL: server.URL, Timeout: 5 * time.Second}
		client := NewOneCClient(config)

		ctx := context.Background()
		err := client.UpdateStock(ctx, "SKU001", 15)
		if err == nil {
			t.Error("expected error for bad request")
		}
	})
}

func TestOneCSetAuth(t *testing.T) {
	t.Run("with api key", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader != "Bearer api-key-123" {
				t.Errorf("expected Bearer token, got '%s'", authHeader)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		config := &Config{
			BaseURL: server.URL,
			APIKey:  "api-key-123",
			Timeout: 5 * time.Second,
		}
		client := NewOneCClient(config)

		ctx := context.Background()
		_ = client.Connect(ctx)
	})

	t.Run("with basic auth", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, pass, ok := r.BasicAuth()
			if !ok {
				t.Error("expected basic auth")
			}
			if user != "admin" || pass != "secret" {
				t.Errorf("expected admin:secret, got %s:%s", user, pass)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		config := &Config{
			BaseURL:  server.URL,
			Username: "admin",
			Password: "secret",
			Timeout:  5 * time.Second,
		}
		client := NewOneCClient(config)

		ctx := context.Background()
		_ = client.Connect(ctx)
	})
}

// ============================================================================
// Data Structures Tests
// ============================================================================

func TestProductStruct(t *testing.T) {
	product := Product{
		ExternalID:    "ext-123",
		SKU:           "SKU001",
		Name:          "Test Product",
		Quantity:      100,
		ReservedQty:   10,
		AvailableQty:  90,
		Price:         999.99,
		CostPrice:     500.00,
		WarehouseID:   "wh-1",
		WarehouseName: "Main Warehouse",
		LastUpdated:   time.Now(),
	}

	if product.AvailableQty != product.Quantity-product.ReservedQty {
		t.Error("available quantity should be quantity minus reserved")
	}
}

func TestSyncResultStruct(t *testing.T) {
	now := time.Now()
	completed := now.Add(5 * time.Second)

	result := SyncResult{
		ID:          "sync-123",
		Direction:   SyncDirectionPull,
		Status:      SyncStatusCompleted,
		TotalItems:  100,
		SyncedItems: 95,
		FailedItems: 5,
		Errors: []SyncError{
			{SKU: "SKU001", Message: "Update failed", Code: "UPDATE_ERROR"},
		},
		StartedAt:   now,
		CompletedAt: &completed,
		Duration:    5 * time.Second,
	}

	if result.SyncedItems+result.FailedItems != result.TotalItems {
		t.Error("synced + failed should equal total")
	}
}

func TestSyncErrorStruct(t *testing.T) {
	err := SyncError{
		SKU:     "SKU001",
		Message: "Product not found",
		Code:    "NOT_FOUND",
	}

	if err.SKU != "SKU001" {
		t.Errorf("expected SKU 'SKU001', got '%s'", err.SKU)
	}
}

// ============================================================================
// Constants Tests
// ============================================================================

func TestSyncStatus(t *testing.T) {
	statuses := []SyncStatus{
		SyncStatusPending,
		SyncStatusRunning,
		SyncStatusCompleted,
		SyncStatusFailed,
	}

	expected := []string{"pending", "running", "completed", "failed"}

	for i, status := range statuses {
		if string(status) != expected[i] {
			t.Errorf("expected '%s', got '%s'", expected[i], status)
		}
	}
}

func TestSyncDirection(t *testing.T) {
	directions := []SyncDirection{
		SyncDirectionPull,
		SyncDirectionPush,
		SyncDirectionBoth,
	}

	expected := []string{"pull", "push", "both"}

	for i, dir := range directions {
		if string(dir) != expected[i] {
			t.Errorf("expected '%s', got '%s'", expected[i], dir)
		}
	}
}

func TestERPType(t *testing.T) {
	types := []ERPType{
		ERP1C,
		ERPOdoo,
		ERPSalesforce,
		ERPCustom,
	}

	expected := []string{"1c", "odoo", "salesforce", "custom"}

	for i, erpType := range types {
		if string(erpType) != expected[i] {
			t.Errorf("expected '%s', got '%s'", expected[i], erpType)
		}
	}
}

// ============================================================================
// Error Tests
// ============================================================================

func TestErrors(t *testing.T) {
	errs := []error{
		ErrSyncFailed,
		ErrProductNotFound,
		ErrConnectionError,
	}

	for _, err := range errs {
		if err == nil {
			t.Error("expected error to be defined")
		}
		if err.Error() == "" {
			t.Error("expected error message to be non-empty")
		}
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkBulkUpdate(b *testing.B) {
	repo := newMockRepository()

	products := make([]*Product, 100)
	for i := 0; i < 100; i++ {
		products[i] = &Product{
			SKU:      "SKU" + string(rune(i)),
			Quantity: i * 10,
		}
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = repo.BulkUpdateInventory(ctx, products)
	}
}

func BenchmarkSyncNow(b *testing.B) {
	repo := newMockRepository()
	config := DefaultConfig()
	service := NewService(repo, config)
	client := newMockERPClient()
	client.products = make([]*Product, 100)
	for i := 0; i < 100; i++ {
		client.products[i] = &Product{
			SKU:      "SKU" + string(rune(i)),
			Quantity: i * 10,
		}
	}
	service.SetClient(client)

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = service.SyncNow(ctx, SyncDirectionPull)
	}
}
