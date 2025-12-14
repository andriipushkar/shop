package domains

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// ==================== Mock Repository ====================

type mockRepository struct {
	mu           sync.RWMutex
	domains      map[string]*Domain
	byDomain     map[string]*Domain
	byTenant     map[string][]*Domain
	certificates map[string]*SSLCertificate
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		domains:      make(map[string]*Domain),
		byDomain:     make(map[string]*Domain),
		byTenant:     make(map[string][]*Domain),
		certificates: make(map[string]*SSLCertificate),
	}
}

func (r *mockRepository) Create(ctx context.Context, domain *Domain) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.byDomain[domain.Domain]; exists {
		return ErrDomainAlreadyExists
	}

	r.domains[domain.ID] = domain
	r.byDomain[domain.Domain] = domain
	r.byTenant[domain.TenantID] = append(r.byTenant[domain.TenantID], domain)
	return nil
}

func (r *mockRepository) GetByID(ctx context.Context, id string) (*Domain, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if domain, ok := r.domains[id]; ok {
		return domain, nil
	}
	return nil, ErrDomainNotFound
}

func (r *mockRepository) GetByDomain(ctx context.Context, domain string) (*Domain, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if d, ok := r.byDomain[domain]; ok {
		return d, nil
	}
	return nil, ErrDomainNotFound
}

func (r *mockRepository) ListByTenant(ctx context.Context, tenantID string) ([]*Domain, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.byTenant[tenantID], nil
}

func (r *mockRepository) Update(ctx context.Context, domain *Domain) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.domains[domain.ID]; !ok {
		return ErrDomainNotFound
	}

	r.domains[domain.ID] = domain
	r.byDomain[domain.Domain] = domain
	return nil
}

func (r *mockRepository) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	domain, ok := r.domains[id]
	if !ok {
		return ErrDomainNotFound
	}

	delete(r.domains, id)
	delete(r.byDomain, domain.Domain)

	// Remove from tenant list
	newList := make([]*Domain, 0)
	for _, d := range r.byTenant[domain.TenantID] {
		if d.ID != id {
			newList = append(newList, d)
		}
	}
	r.byTenant[domain.TenantID] = newList

	return nil
}

func (r *mockRepository) SaveCertificate(ctx context.Context, cert *SSLCertificate) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.certificates[cert.ID] = cert
	return nil
}

func (r *mockRepository) GetCertificate(ctx context.Context, id string) (*SSLCertificate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if cert, ok := r.certificates[id]; ok {
		return cert, nil
	}
	return nil, errors.New("certificate not found")
}

func (r *mockRepository) GetCertificateByDomain(ctx context.Context, domain string) (*SSLCertificate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, cert := range r.certificates {
		if cert.Domain == domain {
			return cert, nil
		}
	}
	return nil, errors.New("certificate not found")
}

func (r *mockRepository) ListExpiringCertificates(ctx context.Context, days int) ([]*SSLCertificate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cutoff := time.Now().AddDate(0, 0, days)
	var expiring []*SSLCertificate

	for _, cert := range r.certificates {
		if cert.ExpiresAt.Before(cutoff) {
			expiring = append(expiring, cert)
		}
	}

	return expiring, nil
}

// ==================== Mock DNS Provider ====================

type mockDNSProvider struct {
	mu       sync.RWMutex
	records  map[string]map[string]DNSRecord
	zoneIDs  map[string]string
	failNext bool
}

func newMockDNSProvider() *mockDNSProvider {
	return &mockDNSProvider{
		records: make(map[string]map[string]DNSRecord),
		zoneIDs: map[string]string{
			"shop.com": "zone_123",
		},
	}
}

func (p *mockDNSProvider) CreateRecord(ctx context.Context, zoneID string, record DNSRecord) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.failNext {
		p.failNext = false
		return "", errors.New("DNS creation failed")
	}

	if p.records[zoneID] == nil {
		p.records[zoneID] = make(map[string]DNSRecord)
	}

	recordID := "rec_" + record.Name
	p.records[zoneID][recordID] = record
	return recordID, nil
}

func (p *mockDNSProvider) UpdateRecord(ctx context.Context, zoneID, recordID string, record DNSRecord) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.records[zoneID] == nil {
		return errors.New("zone not found")
	}

	p.records[zoneID][recordID] = record
	return nil
}

func (p *mockDNSProvider) DeleteRecord(ctx context.Context, zoneID, recordID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.records[zoneID] != nil {
		delete(p.records[zoneID], recordID)
	}
	return nil
}

func (p *mockDNSProvider) GetZoneID(ctx context.Context, domain string) (string, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if zoneID, ok := p.zoneIDs[domain]; ok {
		return zoneID, nil
	}
	return "", errors.New("zone not found")
}

func (p *mockDNSProvider) ListRecords(ctx context.Context, zoneID string) ([]DNSRecord, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var records []DNSRecord
	for _, rec := range p.records[zoneID] {
		records = append(records, rec)
	}
	return records, nil
}

// ==================== Mock SSL Provider ====================

type mockSSLProvider struct {
	mu       sync.RWMutex
	certs    map[string]*SSLCertificate
	failNext bool
	counter  int
}

func newMockSSLProvider() *mockSSLProvider {
	return &mockSSLProvider{
		certs: make(map[string]*SSLCertificate),
	}
}

func (p *mockSSLProvider) ProvisionCertificate(ctx context.Context, domain string) (*SSLCertificate, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.failNext {
		p.failNext = false
		return nil, ErrSSLProvisioningFailed
	}

	p.counter++
	cert := &SSLCertificate{
		ID:        "cert_" + domain,
		Domain:    domain,
		Provider:  "letsencrypt",
		Status:    SSLActive,
		IssuedAt:  time.Now(),
		ExpiresAt: time.Now().AddDate(0, 3, 0),
	}

	p.certs[cert.ID] = cert
	return cert, nil
}

func (p *mockSSLProvider) RenewCertificate(ctx context.Context, certID string) (*SSLCertificate, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.failNext {
		p.failNext = false
		return nil, errors.New("renewal failed")
	}

	oldCert, ok := p.certs[certID]
	if !ok {
		return nil, errors.New("certificate not found")
	}

	newCert := &SSLCertificate{
		ID:        certID + "_renewed",
		Domain:    oldCert.Domain,
		Provider:  oldCert.Provider,
		Status:    SSLActive,
		IssuedAt:  time.Now(),
		ExpiresAt: time.Now().AddDate(0, 3, 0),
	}

	p.certs[newCert.ID] = newCert
	return newCert, nil
}

func (p *mockSSLProvider) RevokeCertificate(ctx context.Context, certID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	delete(p.certs, certID)
	return nil
}

func (p *mockSSLProvider) GetCertificateStatus(ctx context.Context, certID string) (SSLStatus, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if cert, ok := p.certs[certID]; ok {
		return cert.Status, nil
	}
	return SSLNone, errors.New("certificate not found")
}

// ==================== Tests ====================

func TestAddSubdomain(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	t.Run("valid subdomain", func(t *testing.T) {
		domain, err := svc.AddSubdomain(ctx, "tenant_1", "mystore")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if domain.Domain != "mystore.shop.com" {
			t.Errorf("Expected domain mystore.shop.com, got %s", domain.Domain)
		}

		if domain.Type != TypeSubdomain {
			t.Errorf("Expected type subdomain, got %s", domain.Type)
		}

		if domain.Status != StatusActive {
			t.Errorf("Expected status active, got %s", domain.Status)
		}

		if !domain.IsPrimary {
			t.Error("Expected subdomain to be primary")
		}

		if domain.CloudflareZoneID == "" {
			t.Error("Expected Cloudflare zone ID to be set")
		}

		if domain.CloudflareDNSID == "" {
			t.Error("Expected Cloudflare DNS ID to be set")
		}
	})

	t.Run("duplicate subdomain same tenant", func(t *testing.T) {
		domain, err := svc.AddSubdomain(ctx, "tenant_1", "mystore")
		if err != nil {
			t.Fatalf("Expected no error for same tenant, got %v", err)
		}

		if domain.Domain != "mystore.shop.com" {
			t.Errorf("Expected existing domain to be returned")
		}
	})

	t.Run("duplicate subdomain different tenant", func(t *testing.T) {
		_, err := svc.AddSubdomain(ctx, "tenant_2", "mystore")
		if err != ErrDomainInUse {
			t.Errorf("Expected ErrDomainInUse, got %v", err)
		}
	})

	t.Run("invalid subdomain", func(t *testing.T) {
		_, err := svc.AddSubdomain(ctx, "tenant_1", "a")
		if err != ErrInvalidDomain {
			t.Errorf("Expected ErrInvalidDomain for too short subdomain, got %v", err)
		}

		_, err = svc.AddSubdomain(ctx, "tenant_1", "test_store")
		if err != ErrInvalidDomain {
			t.Errorf("Expected ErrInvalidDomain for underscore, got %v", err)
		}
	})
}

func TestAddCustomDomain(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	t.Run("valid custom domain", func(t *testing.T) {
		domain, err := svc.AddCustomDomain(ctx, "tenant_1", "mystore.com")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if domain.Domain != "mystore.com" {
			t.Errorf("Expected domain mystore.com, got %s", domain.Domain)
		}

		if domain.Type != TypeCustom {
			t.Errorf("Expected type custom, got %s", domain.Type)
		}

		if domain.Status != StatusPendingVerification {
			t.Errorf("Expected status pending_verification, got %s", domain.Status)
		}

		if domain.VerificationToken == "" {
			t.Error("Expected verification token to be set")
		}

		if domain.VerificationType != "TXT" {
			t.Errorf("Expected verification type TXT, got %s", domain.VerificationType)
		}
	})

	t.Run("duplicate custom domain different tenant", func(t *testing.T) {
		_, err := svc.AddCustomDomain(ctx, "tenant_2", "mystore.com")
		if err != ErrDomainInUse {
			t.Errorf("Expected ErrDomainInUse, got %v", err)
		}
	})

	t.Run("invalid domain", func(t *testing.T) {
		_, err := svc.AddCustomDomain(ctx, "tenant_1", "invalid")
		if err != ErrInvalidDomain {
			t.Errorf("Expected ErrInvalidDomain, got %v", err)
		}
	})
}

func TestGetVerificationInstructions(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	// Create custom domain
	domain, _ := svc.AddCustomDomain(ctx, "tenant_1", "example.com")

	t.Run("get instructions", func(t *testing.T) {
		instructions, err := svc.GetVerificationInstructions(ctx, domain.ID)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if len(instructions.Records) != 2 {
			t.Errorf("Expected 2 DNS records, got %d", len(instructions.Records))
		}

		// Check TXT record
		txtFound := false
		for _, rec := range instructions.Records {
			if rec.Type == "TXT" && rec.Name == "_shop-verification" {
				txtFound = true
				if rec.Value != domain.VerificationToken {
					t.Error("TXT record value doesn't match verification token")
				}
			}
		}
		if !txtFound {
			t.Error("TXT record not found in instructions")
		}

		if instructions.Instructions == "" {
			t.Error("Expected instructions text")
		}
	})

	t.Run("subdomain no instructions", func(t *testing.T) {
		subdomain, _ := svc.AddSubdomain(ctx, "tenant_2", "another")
		_, err := svc.GetVerificationInstructions(ctx, subdomain.ID)
		if err == nil {
			t.Error("Expected error for subdomain verification")
		}
	})
}

func TestListDomains(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	// Add multiple domains
	svc.AddSubdomain(ctx, "tenant_1", "store1")
	svc.AddSubdomain(ctx, "tenant_1", "store2")
	svc.AddCustomDomain(ctx, "tenant_1", "mystore.net")

	t.Run("list tenant domains", func(t *testing.T) {
		domains, err := svc.ListDomains(ctx, "tenant_1")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if len(domains) != 3 {
			t.Errorf("Expected 3 domains, got %d", len(domains))
		}
	})

	t.Run("list empty tenant", func(t *testing.T) {
		domains, err := svc.ListDomains(ctx, "tenant_empty")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if len(domains) != 0 {
			t.Errorf("Expected 0 domains, got %d", len(domains))
		}
	})
}

func TestSetPrimary(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	// Add domains
	domain1, _ := svc.AddSubdomain(ctx, "tenant_1", "store1")
	domain2, _ := svc.AddSubdomain(ctx, "tenant_1", "store2")

	t.Run("set new primary", func(t *testing.T) {
		err := svc.SetPrimary(ctx, domain2.ID)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		// Check domain2 is primary
		updated, _ := svc.GetDomain(ctx, domain2.ID)
		if !updated.IsPrimary {
			t.Error("Expected domain2 to be primary")
		}

		// Check domain1 is no longer primary
		updated1, _ := svc.GetDomain(ctx, domain1.ID)
		if updated1.IsPrimary {
			t.Error("Expected domain1 to not be primary")
		}
	})

	t.Run("cannot set non-active as primary", func(t *testing.T) {
		customDomain, _ := svc.AddCustomDomain(ctx, "tenant_1", "pending.com")
		err := svc.SetPrimary(ctx, customDomain.ID)
		if err == nil {
			t.Error("Expected error for non-active domain")
		}
	})
}

func TestDeleteDomain(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	domain, _ := svc.AddSubdomain(ctx, "tenant_1", "todelete")

	t.Run("delete domain", func(t *testing.T) {
		err := svc.DeleteDomain(ctx, domain.ID)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		// Verify deleted
		_, err = svc.GetDomain(ctx, domain.ID)
		if err != ErrDomainNotFound {
			t.Error("Expected domain to be deleted")
		}
	})

	t.Run("delete non-existent", func(t *testing.T) {
		err := svc.DeleteDomain(ctx, "non_existent")
		if err != ErrDomainNotFound {
			t.Errorf("Expected ErrDomainNotFound, got %v", err)
		}
	})
}

func TestSSLRenewal(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	// Add subdomain
	domain, _ := svc.AddSubdomain(ctx, "tenant_1", "ssltest")

	// Wait for async SSL provisioning
	time.Sleep(100 * time.Millisecond)

	t.Run("renew existing certificate", func(t *testing.T) {
		// Manually set certificate ID
		domain.SSLCertificateID = "cert_ssltest.shop.com"
		repo.Update(ctx, domain)

		err := svc.RenewSSL(ctx, domain.ID)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		updated, _ := svc.GetDomain(ctx, domain.ID)
		if updated.SSLStatus != SSLActive {
			t.Errorf("Expected SSL status active, got %s", updated.SSLStatus)
		}
	})

	t.Run("provision new certificate", func(t *testing.T) {
		// Create domain without certificate
		newDomain, _ := svc.AddSubdomain(ctx, "tenant_2", "newssl")
		newDomain.SSLCertificateID = ""
		repo.Update(ctx, newDomain)

		err := svc.RenewSSL(ctx, newDomain.ID)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
	})
}

func TestCheckExpiringCertificates(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	// Create domain with expiring certificate
	domain, _ := svc.AddSubdomain(ctx, "tenant_1", "expiring")

	// Create expiring certificate
	expiresAt := time.Now().AddDate(0, 0, 15) // Expires in 15 days
	cert := &SSLCertificate{
		ID:        "cert_expiring",
		DomainID:  domain.ID,
		Domain:    domain.Domain,
		Provider:  "letsencrypt",
		Status:    SSLExpiring,
		IssuedAt:  time.Now().AddDate(0, -3, 0),
		ExpiresAt: expiresAt,
	}
	repo.SaveCertificate(ctx, cert)
	domain.SSLCertificateID = cert.ID
	repo.Update(ctx, domain)

	t.Run("renew expiring certificates", func(t *testing.T) {
		err := svc.CheckExpiringCertificates(ctx)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
	})
}

func TestIsSubdomain(t *testing.T) {
	svc := NewService(nil, nil, nil, "shop.com", "")

	tests := []struct {
		domain   string
		expected bool
	}{
		{"mystore.shop.com", true},
		{"sub.mystore.shop.com", true},
		{"shop.com", false},
		{"mystore.other.com", false},
		{"othershop.com", false},
	}

	for _, tc := range tests {
		t.Run(tc.domain, func(t *testing.T) {
			result := svc.IsSubdomain(tc.domain)
			if result != tc.expected {
				t.Errorf("IsSubdomain(%s) = %v, expected %v", tc.domain, result, tc.expected)
			}
		})
	}
}

func TestValidSubdomain(t *testing.T) {
	tests := []struct {
		subdomain string
		valid     bool
	}{
		{"mystore", true},
		{"my-store", true},
		{"store123", true},
		{"123store", true},
		{"a", false},                  // too short
		{"ab", false},                 // too short
		{"abc", true},                 // minimum length
		{"-invalid", false},           // starts with dash
		{"invalid-", false},           // ends with dash
		{"test_store", false},         // underscore not allowed
		{"test.store", false},         // dot not allowed
		{"UPPERCASE", true},           // converted to lowercase
	}

	for _, tc := range tests {
		t.Run(tc.subdomain, func(t *testing.T) {
			result := isValidSubdomain(tc.subdomain)
			if result != tc.valid {
				t.Errorf("isValidSubdomain(%s) = %v, expected %v", tc.subdomain, result, tc.valid)
			}
		})
	}
}

func TestValidDomain(t *testing.T) {
	tests := []struct {
		domain string
		valid  bool
	}{
		{"example.com", true},
		{"sub.example.com", true},
		{"my-store.com", true},
		{"store123.net", true},
		{"invalid", false},             // no TLD
		{"example.c", false},           // TLD too short
		{"-invalid.com", false},        // starts with dash
		{"invalid-.com", false},        // ends with dash
		{"test_store.com", false},      // underscore not allowed
		{"EXAMPLE.COM", true},          // converted to lowercase
	}

	for _, tc := range tests {
		t.Run(tc.domain, func(t *testing.T) {
			result := isValidDomain(tc.domain)
			if result != tc.valid {
				t.Errorf("isValidDomain(%s) = %v, expected %v", tc.domain, result, tc.valid)
			}
		})
	}
}

func TestDomainStatus(t *testing.T) {
	statuses := []DomainStatus{
		StatusPendingVerification,
		StatusVerifying,
		StatusVerified,
		StatusProvisioningSSL,
		StatusActive,
		StatusFailed,
		StatusExpired,
	}

	for _, status := range statuses {
		if status == "" {
			t.Errorf("Domain status should not be empty")
		}
	}
}

func TestSSLStatus(t *testing.T) {
	statuses := []SSLStatus{
		SSLNone,
		SSLPending,
		SSLProvisioning,
		SSLActive,
		SSLExpiring,
		SSLExpired,
		SSLFailed,
	}

	for _, status := range statuses {
		if status == "" && status != SSLNone {
			t.Errorf("SSL status should not be empty")
		}
	}
}

func TestDomainType(t *testing.T) {
	types := []DomainType{
		TypeSubdomain,
		TypeCustom,
	}

	for _, typ := range types {
		if typ == "" {
			t.Errorf("Domain type should not be empty")
		}
	}
}

func TestGenerateFunctions(t *testing.T) {
	t.Run("generate domain ID", func(t *testing.T) {
		id1 := generateDomainID()
		id2 := generateDomainID()

		if id1 == id2 {
			t.Error("Generated IDs should be unique")
		}

		if len(id1) < 10 {
			t.Error("Domain ID too short")
		}

		if id1[:4] != "dom_" {
			t.Errorf("Domain ID should start with 'dom_', got %s", id1)
		}
	})

	t.Run("generate verification token", func(t *testing.T) {
		token1 := generateVerificationToken()
		token2 := generateVerificationToken()

		if token1 == token2 {
			t.Error("Generated tokens should be unique")
		}

		if len(token1) < 20 {
			t.Error("Verification token too short")
		}

		if token1[:12] != "shop-verify-" {
			t.Errorf("Token should start with 'shop-verify-', got %s", token1)
		}
	})
}

func TestDNSRecord(t *testing.T) {
	record := DNSRecord{
		Type:     "A",
		Name:     "test",
		Value:    "10.0.0.1",
		TTL:      300,
		Priority: 0,
		Proxied:  true,
	}

	if record.Type != "A" {
		t.Errorf("Expected type A, got %s", record.Type)
	}

	if record.TTL != 300 {
		t.Errorf("Expected TTL 300, got %d", record.TTL)
	}
}

func TestSSLCertificate(t *testing.T) {
	now := time.Now()
	expires := now.AddDate(0, 3, 0)

	cert := SSLCertificate{
		ID:        "cert_123",
		DomainID:  "dom_456",
		Domain:    "example.com",
		Provider:  "letsencrypt",
		Status:    SSLActive,
		IssuedAt:  now,
		ExpiresAt: expires,
	}

	if cert.Provider != "letsencrypt" {
		t.Errorf("Expected provider letsencrypt, got %s", cert.Provider)
	}

	if cert.ExpiresAt.Before(now) {
		t.Error("Certificate should not be expired")
	}
}

func TestErrors(t *testing.T) {
	errors := []error{
		ErrDomainNotFound,
		ErrDomainAlreadyExists,
		ErrDomainNotVerified,
		ErrDNSVerificationFailed,
		ErrSSLProvisioningFailed,
		ErrInvalidDomain,
		ErrDomainInUse,
	}

	for _, err := range errors {
		if err == nil {
			t.Error("Error should not be nil")
		}
		if err.Error() == "" {
			t.Error("Error message should not be empty")
		}
	}
}

func TestConcurrentDomainOperations(t *testing.T) {
	repo := newMockRepository()
	dnsProvider := newMockDNSProvider()
	sslProvider := newMockSSLProvider()

	svc := NewService(repo, dnsProvider, sslProvider, "shop.com", "10.0.0.1")

	ctx := context.Background()

	var wg sync.WaitGroup
	errors := make(chan error, 10)

	// Concurrent subdomain creation
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			subdomain := "concurrent" + string(rune('a'+idx))
			_, err := svc.AddSubdomain(ctx, "tenant_concurrent", subdomain)
			if err != nil {
				errors <- err
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	for err := range errors {
		t.Errorf("Concurrent operation failed: %v", err)
	}

	// Verify all domains created
	domains, _ := svc.ListDomains(ctx, "tenant_concurrent")
	if len(domains) != 10 {
		t.Errorf("Expected 10 domains, got %d", len(domains))
	}
}
