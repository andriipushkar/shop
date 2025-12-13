package tenant

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// MockRepository for testing
type MockRepository struct {
	tenants map[string]*Tenant
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		tenants: make(map[string]*Tenant),
	}
}

func (m *MockRepository) Create(ctx context.Context, tenant *Tenant) error {
	m.tenants[tenant.ID] = tenant
	return nil
}

func (m *MockRepository) GetByID(ctx context.Context, id string) (*Tenant, error) {
	if t, ok := m.tenants[id]; ok {
		return t, nil
	}
	return nil, ErrTenantNotFound
}

func (m *MockRepository) GetBySlug(ctx context.Context, slug string) (*Tenant, error) {
	for _, t := range m.tenants {
		if t.Slug == slug {
			return t, nil
		}
	}
	return nil, ErrTenantNotFound
}

func (m *MockRepository) GetByDomain(ctx context.Context, domain string) (*Tenant, error) {
	for _, t := range m.tenants {
		if t.Domain == domain || t.CustomDomain == domain {
			return t, nil
		}
	}
	return nil, ErrTenantNotFound
}

func (m *MockRepository) Update(ctx context.Context, tenant *Tenant) error {
	m.tenants[tenant.ID] = tenant
	return nil
}

func (m *MockRepository) Delete(ctx context.Context, id string) error {
	delete(m.tenants, id)
	return nil
}

func (m *MockRepository) List(ctx context.Context, filter TenantFilter) ([]*Tenant, int, error) {
	var result []*Tenant
	for _, t := range m.tenants {
		if filter.Status != "" && t.Status != TenantStatus(filter.Status) {
			continue
		}
		result = append(result, t)
	}
	return result, len(result), nil
}

func (m *MockRepository) IncrementUsage(ctx context.Context, id string, field string, delta int) error {
	if t, ok := m.tenants[id]; ok {
		switch field {
		case "product_count":
			t.ProductCount += delta
		case "order_count":
			t.OrderCount += delta
		case "storage_used":
			t.StorageUsed += int64(delta)
		}
	}
	return nil
}

// MockCache for testing
type MockCache struct {
	data map[string]*Tenant
}

func NewMockCache() *MockCache {
	return &MockCache{
		data: make(map[string]*Tenant),
	}
}

func (m *MockCache) Get(ctx context.Context, key string) (*Tenant, error) {
	if t, ok := m.data[key]; ok {
		return t, nil
	}
	return nil, nil
}

func (m *MockCache) Set(ctx context.Context, key string, tenant *Tenant, ttl time.Duration) error {
	m.data[key] = tenant
	return nil
}

func (m *MockCache) Delete(ctx context.Context, key string) error {
	delete(m.data, key)
	return nil
}

func TestTenantService_Create(t *testing.T) {
	repo := NewMockRepository()
	cache := NewMockCache()
	service := NewTenantService(repo, cache)

	input := CreateTenantInput{
		Name:    "Test Store",
		Slug:    "test-store",
		OwnerID: "user-123",
		Plan:    PlanStarter,
	}

	tenant, err := service.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tenant.Name != input.Name {
		t.Errorf("expected name %s, got %s", input.Name, tenant.Name)
	}

	if tenant.Slug != input.Slug {
		t.Errorf("expected slug %s, got %s", input.Slug, tenant.Slug)
	}

	if tenant.Plan != PlanStarter {
		t.Errorf("expected plan %s, got %s", PlanStarter, tenant.Plan)
	}

	if tenant.Status != StatusActive {
		t.Errorf("expected status %s, got %s", StatusActive, tenant.Status)
	}

	// Check limits are set correctly for Starter plan
	if tenant.ProductLimit != 500 {
		t.Errorf("expected product limit 500, got %d", tenant.ProductLimit)
	}
}

func TestTenantService_GetBySlug(t *testing.T) {
	repo := NewMockRepository()
	cache := NewMockCache()
	service := NewTenantService(repo, cache)

	// Create a tenant first
	tenant := &Tenant{
		ID:     "tenant-1",
		Slug:   "my-store",
		Name:   "My Store",
		Status: StatusActive,
	}
	repo.tenants[tenant.ID] = tenant

	// Get by slug
	found, err := service.GetBySlug(context.Background(), "my-store")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if found.ID != tenant.ID {
		t.Errorf("expected ID %s, got %s", tenant.ID, found.ID)
	}

	// Check cache was populated
	if cache.data["slug:my-store"] == nil {
		t.Error("expected tenant to be cached")
	}
}

func TestTenantService_CheckQuota(t *testing.T) {
	repo := NewMockRepository()
	cache := NewMockCache()
	service := NewTenantService(repo, cache)

	tenant := &Tenant{
		ID:           "tenant-1",
		Slug:         "test",
		Name:         "Test",
		Status:       StatusActive,
		Plan:         PlanFree,
		ProductLimit: 50,
		ProductCount: 49,
	}
	repo.tenants[tenant.ID] = tenant

	// Should be allowed
	allowed, err := service.CheckQuota(context.Background(), "tenant-1", "products", 1)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !allowed {
		t.Error("expected quota check to pass")
	}

	// Should exceed quota
	allowed, err = service.CheckQuota(context.Background(), "tenant-1", "products", 2)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if allowed {
		t.Error("expected quota check to fail")
	}
}

func TestTenantService_IncrementUsage(t *testing.T) {
	repo := NewMockRepository()
	cache := NewMockCache()
	service := NewTenantService(repo, cache)

	tenant := &Tenant{
		ID:           "tenant-1",
		Slug:         "test",
		Name:         "Test",
		ProductCount: 10,
	}
	repo.tenants[tenant.ID] = tenant

	err := service.IncrementUsage(context.Background(), "tenant-1", "products", 5)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if repo.tenants["tenant-1"].ProductCount != 15 {
		t.Errorf("expected product count 15, got %d", repo.tenants["tenant-1"].ProductCount)
	}
}

func TestTenantMiddleware(t *testing.T) {
	repo := NewMockRepository()
	cache := NewMockCache()
	service := NewTenantService(repo, cache)

	tenant := &Tenant{
		ID:     "tenant-1",
		Slug:   "mystore",
		Domain: "mystore.shop.com",
		Status: StatusActive,
	}
	repo.tenants[tenant.ID] = tenant

	middleware := TenantMiddleware(service, "shop.com")

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		t := FromContext(ctx)
		if t == nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(t.ID))
	}))

	tests := []struct {
		name           string
		host           string
		headerTenantID string
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "subdomain resolution",
			host:           "mystore.shop.com",
			expectedStatus: http.StatusOK,
			expectedBody:   "tenant-1",
		},
		{
			name:           "header resolution",
			host:           "api.shop.com",
			headerTenantID: "tenant-1",
			expectedStatus: http.StatusOK,
			expectedBody:   "tenant-1",
		},
		{
			name:           "unknown tenant",
			host:           "unknown.shop.com",
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.Host = tt.host
			if tt.headerTenantID != "" {
				req.Header.Set("X-Tenant-ID", tt.headerTenantID)
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			if tt.expectedBody != "" && rec.Body.String() != tt.expectedBody {
				t.Errorf("expected body %s, got %s", tt.expectedBody, rec.Body.String())
			}
		})
	}
}

func TestTenantStatus_Validation(t *testing.T) {
	repo := NewMockRepository()
	cache := NewMockCache()
	service := NewTenantService(repo, cache)

	// Suspended tenant
	tenant := &Tenant{
		ID:     "tenant-1",
		Slug:   "suspended",
		Status: StatusSuspended,
	}
	repo.tenants[tenant.ID] = tenant

	_, err := service.GetBySlug(context.Background(), "suspended")
	if err != ErrTenantSuspended {
		t.Errorf("expected ErrTenantSuspended, got %v", err)
	}
}

func TestPlanLimits(t *testing.T) {
	tests := []struct {
		plan          TenantPlan
		productLimit  int
		orderLimit    int
		storageLimit  int64
	}{
		{PlanFree, 50, 100, 100 * 1024 * 1024},
		{PlanStarter, 500, 1000, 1024 * 1024 * 1024},
		{PlanProfessional, 5000, 10000, 10 * 1024 * 1024 * 1024},
		{PlanEnterprise, -1, -1, -1},
	}

	for _, tt := range tests {
		t.Run(string(tt.plan), func(t *testing.T) {
			limits := GetPlanLimits(tt.plan)
			if limits.ProductLimit != tt.productLimit {
				t.Errorf("expected product limit %d, got %d", tt.productLimit, limits.ProductLimit)
			}
			if limits.OrderLimit != tt.orderLimit {
				t.Errorf("expected order limit %d, got %d", tt.orderLimit, limits.OrderLimit)
			}
			if limits.StorageLimit != tt.storageLimit {
				t.Errorf("expected storage limit %d, got %d", tt.storageLimit, limits.StorageLimit)
			}
		})
	}
}
