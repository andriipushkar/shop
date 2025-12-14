package domains

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"
)

// Errors
var (
	ErrDomainNotFound        = errors.New("domain not found")
	ErrDomainAlreadyExists   = errors.New("domain already registered")
	ErrDomainNotVerified     = errors.New("domain not verified")
	ErrDNSVerificationFailed = errors.New("DNS verification failed")
	ErrSSLProvisioningFailed = errors.New("SSL provisioning failed")
	ErrInvalidDomain         = errors.New("invalid domain format")
	ErrDomainInUse           = errors.New("domain already in use by another tenant")
)

// DomainStatus represents domain status
type DomainStatus string

const (
	StatusPendingVerification DomainStatus = "pending_verification"
	StatusVerifying           DomainStatus = "verifying"
	StatusVerified            DomainStatus = "verified"
	StatusProvisioningSSL     DomainStatus = "provisioning_ssl"
	StatusActive              DomainStatus = "active"
	StatusFailed              DomainStatus = "failed"
	StatusExpired             DomainStatus = "expired"
)

// DomainType represents the type of domain
type DomainType string

const (
	TypeSubdomain DomainType = "subdomain" // tenant.shop.com
	TypeCustom    DomainType = "custom"    // mystore.com
)

// SSLStatus represents SSL certificate status
type SSLStatus string

const (
	SSLNone        SSLStatus = "none"
	SSLPending     SSLStatus = "pending"
	SSLProvisioning SSLStatus = "provisioning"
	SSLActive      SSLStatus = "active"
	SSLExpiring    SSLStatus = "expiring"
	SSLExpired     SSLStatus = "expired"
	SSLFailed      SSLStatus = "failed"
)

// Domain represents a domain configuration
type Domain struct {
	ID              string       `json:"id"`
	TenantID        string       `json:"tenant_id"`
	Domain          string       `json:"domain"`
	Type            DomainType   `json:"type"`
	Status          DomainStatus `json:"status"`
	IsPrimary       bool         `json:"is_primary"`

	// DNS Verification
	VerificationToken string     `json:"verification_token,omitempty"`
	VerificationType  string     `json:"verification_type,omitempty"` // TXT, CNAME
	VerifiedAt        *time.Time `json:"verified_at,omitempty"`

	// SSL Configuration
	SSLStatus       SSLStatus  `json:"ssl_status"`
	SSLProvider     string     `json:"ssl_provider,omitempty"` // letsencrypt, cloudflare
	SSLCertificateID string    `json:"ssl_certificate_id,omitempty"`
	SSLExpiresAt    *time.Time `json:"ssl_expires_at,omitempty"`
	SSLAutoRenew    bool       `json:"ssl_auto_renew"`

	// Cloudflare Integration
	CloudflareZoneID  string `json:"cloudflare_zone_id,omitempty"`
	CloudflareDNSID   string `json:"cloudflare_dns_id,omitempty"`
	CloudflareProxied bool   `json:"cloudflare_proxied"`

	// Error tracking
	LastError     string     `json:"last_error,omitempty"`
	LastErrorAt   *time.Time `json:"last_error_at,omitempty"`
	RetryCount    int        `json:"retry_count"`

	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// DNSRecord represents a DNS record to be created
type DNSRecord struct {
	Type     string `json:"type"`     // A, CNAME, TXT
	Name     string `json:"name"`     // subdomain or @ for root
	Value    string `json:"value"`    // IP or domain
	TTL      int    `json:"ttl"`      // Time to live
	Priority int    `json:"priority"` // For MX records
	Proxied  bool   `json:"proxied"`  // Cloudflare proxy
}

// VerificationResult contains DNS verification result
type VerificationResult struct {
	Verified    bool     `json:"verified"`
	RecordFound bool     `json:"record_found"`
	RecordValue string   `json:"record_value,omitempty"`
	Expected    string   `json:"expected"`
	Errors      []string `json:"errors,omitempty"`
}

// SSLCertificate represents an SSL certificate
type SSLCertificate struct {
	ID          string    `json:"id"`
	DomainID    string    `json:"domain_id"`
	Domain      string    `json:"domain"`
	Provider    string    `json:"provider"`
	Status      SSLStatus `json:"status"`
	IssuedAt    time.Time `json:"issued_at"`
	ExpiresAt   time.Time `json:"expires_at"`
	Certificate string    `json:"-"` // PEM encoded
	PrivateKey  string    `json:"-"` // PEM encoded
	Chain       string    `json:"-"` // PEM encoded chain
}

// Repository interface for domain storage
type Repository interface {
	Create(ctx context.Context, domain *Domain) error
	GetByID(ctx context.Context, id string) (*Domain, error)
	GetByDomain(ctx context.Context, domain string) (*Domain, error)
	ListByTenant(ctx context.Context, tenantID string) ([]*Domain, error)
	Update(ctx context.Context, domain *Domain) error
	Delete(ctx context.Context, id string) error

	// SSL Certificates
	SaveCertificate(ctx context.Context, cert *SSLCertificate) error
	GetCertificate(ctx context.Context, id string) (*SSLCertificate, error)
	GetCertificateByDomain(ctx context.Context, domain string) (*SSLCertificate, error)
	ListExpiringCertificates(ctx context.Context, days int) ([]*SSLCertificate, error)
}

// DNSProvider interface for DNS operations
type DNSProvider interface {
	CreateRecord(ctx context.Context, zoneID string, record DNSRecord) (string, error)
	UpdateRecord(ctx context.Context, zoneID, recordID string, record DNSRecord) error
	DeleteRecord(ctx context.Context, zoneID, recordID string) error
	GetZoneID(ctx context.Context, domain string) (string, error)
	ListRecords(ctx context.Context, zoneID string) ([]DNSRecord, error)
}

// SSLProvider interface for SSL operations
type SSLProvider interface {
	ProvisionCertificate(ctx context.Context, domain string) (*SSLCertificate, error)
	RenewCertificate(ctx context.Context, certID string) (*SSLCertificate, error)
	RevokeCertificate(ctx context.Context, certID string) error
	GetCertificateStatus(ctx context.Context, certID string) (SSLStatus, error)
}

// Service handles domain management
type Service struct {
	repo        Repository
	dnsProvider DNSProvider
	sslProvider SSLProvider
	platformDomain string
	loadBalancerIP string
}

// NewService creates a new domain service
func NewService(repo Repository, dnsProvider DNSProvider, sslProvider SSLProvider, platformDomain, loadBalancerIP string) *Service {
	return &Service{
		repo:           repo,
		dnsProvider:    dnsProvider,
		sslProvider:    sslProvider,
		platformDomain: platformDomain,
		loadBalancerIP: loadBalancerIP,
	}
}

// ==================== Domain Operations ====================

// AddSubdomain adds a subdomain for a tenant (tenant.shop.com)
func (s *Service) AddSubdomain(ctx context.Context, tenantID, subdomain string) (*Domain, error) {
	if !isValidSubdomain(subdomain) {
		return nil, ErrInvalidDomain
	}

	fullDomain := fmt.Sprintf("%s.%s", subdomain, s.platformDomain)

	// Check if already exists
	existing, _ := s.repo.GetByDomain(ctx, fullDomain)
	if existing != nil {
		if existing.TenantID != tenantID {
			return nil, ErrDomainInUse
		}
		return existing, nil
	}

	domain := &Domain{
		ID:         generateDomainID(),
		TenantID:   tenantID,
		Domain:     fullDomain,
		Type:       TypeSubdomain,
		Status:     StatusVerified, // Subdomains are auto-verified
		IsPrimary:  true,
		SSLStatus:  SSLPending,
		SSLAutoRenew: true,
		CloudflareProxied: true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Create DNS record
	zoneID, err := s.dnsProvider.GetZoneID(ctx, s.platformDomain)
	if err != nil {
		return nil, err
	}

	recordID, err := s.dnsProvider.CreateRecord(ctx, zoneID, DNSRecord{
		Type:    "A",
		Name:    subdomain,
		Value:   s.loadBalancerIP,
		TTL:     300,
		Proxied: true,
	})
	if err != nil {
		return nil, err
	}

	domain.CloudflareZoneID = zoneID
	domain.CloudflareDNSID = recordID
	domain.Status = StatusActive

	if err := s.repo.Create(ctx, domain); err != nil {
		// Cleanup DNS on failure
		s.dnsProvider.DeleteRecord(ctx, zoneID, recordID)
		return nil, err
	}

	// Provision SSL (async)
	go s.provisionSSL(context.Background(), domain)

	return domain, nil
}

// AddCustomDomain adds a custom domain for a tenant (mystore.com)
func (s *Service) AddCustomDomain(ctx context.Context, tenantID, customDomain string) (*Domain, error) {
	if !isValidDomain(customDomain) {
		return nil, ErrInvalidDomain
	}

	// Check if already exists
	existing, _ := s.repo.GetByDomain(ctx, customDomain)
	if existing != nil {
		if existing.TenantID != tenantID {
			return nil, ErrDomainInUse
		}
		return existing, nil
	}

	// Generate verification token
	token := generateVerificationToken()

	domain := &Domain{
		ID:                generateDomainID(),
		TenantID:          tenantID,
		Domain:            customDomain,
		Type:              TypeCustom,
		Status:            StatusPendingVerification,
		IsPrimary:         false,
		VerificationToken: token,
		VerificationType:  "TXT",
		SSLStatus:         SSLNone,
		SSLAutoRenew:      true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Create(ctx, domain); err != nil {
		return nil, err
	}

	return domain, nil
}

// GetVerificationInstructions returns DNS setup instructions
func (s *Service) GetVerificationInstructions(ctx context.Context, domainID string) (*VerificationInstructions, error) {
	domain, err := s.repo.GetByID(ctx, domainID)
	if err != nil {
		return nil, err
	}

	if domain.Type != TypeCustom {
		return nil, errors.New("verification not required for subdomains")
	}

	return &VerificationInstructions{
		Domain: domain.Domain,
		Records: []DNSRecord{
			{
				Type:  "TXT",
				Name:  "_shop-verification",
				Value: domain.VerificationToken,
				TTL:   3600,
			},
			{
				Type:  "CNAME",
				Name:  "@",
				Value: fmt.Sprintf("proxy.%s", s.platformDomain),
				TTL:   3600,
			},
		},
		Instructions: fmt.Sprintf(
			"1. Add a TXT record: _shop-verification.%s → %s\n"+
			"2. Add a CNAME record: %s → proxy.%s\n"+
			"3. Wait for DNS propagation (up to 48 hours)\n"+
			"4. Click 'Verify Domain'",
			domain.Domain, domain.VerificationToken,
			domain.Domain, s.platformDomain,
		),
	}, nil
}

// VerificationInstructions contains setup instructions
type VerificationInstructions struct {
	Domain       string      `json:"domain"`
	Records      []DNSRecord `json:"records"`
	Instructions string      `json:"instructions"`
}

// VerifyDomain verifies DNS configuration
func (s *Service) VerifyDomain(ctx context.Context, domainID string) (*VerificationResult, error) {
	domain, err := s.repo.GetByID(ctx, domainID)
	if err != nil {
		return nil, err
	}

	if domain.Status == StatusActive || domain.Status == StatusVerified {
		return &VerificationResult{Verified: true}, nil
	}

	result := &VerificationResult{
		Expected: domain.VerificationToken,
	}

	// Check TXT record
	txtHost := fmt.Sprintf("_shop-verification.%s", domain.Domain)
	txtRecords, err := net.LookupTXT(txtHost)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("TXT record not found: %v", err))
	} else {
		for _, txt := range txtRecords {
			if txt == domain.VerificationToken {
				result.RecordFound = true
				result.RecordValue = txt
				break
			}
		}
	}

	if !result.RecordFound {
		result.Errors = append(result.Errors, "Verification token not found in TXT records")
		return result, nil
	}

	// Check CNAME record
	cname, err := net.LookupCNAME(domain.Domain)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("CNAME record not found: %v", err))
		return result, nil
	}

	expectedCNAME := fmt.Sprintf("proxy.%s.", s.platformDomain)
	if !strings.HasSuffix(cname, s.platformDomain+".") {
		result.Errors = append(result.Errors, fmt.Sprintf("CNAME points to %s, expected %s", cname, expectedCNAME))
		return result, nil
	}

	// Verification successful
	result.Verified = true
	now := time.Now()
	domain.Status = StatusVerified
	domain.VerifiedAt = &now
	domain.UpdatedAt = now

	if err := s.repo.Update(ctx, domain); err != nil {
		return nil, err
	}

	// Start SSL provisioning
	go s.provisionSSL(context.Background(), domain)

	return result, nil
}

// provisionSSL provisions SSL certificate for a domain
func (s *Service) provisionSSL(ctx context.Context, domain *Domain) {
	domain.Status = StatusProvisioningSSL
	domain.SSLStatus = SSLProvisioning
	s.repo.Update(ctx, domain)

	cert, err := s.sslProvider.ProvisionCertificate(ctx, domain.Domain)
	if err != nil {
		now := time.Now()
		domain.SSLStatus = SSLFailed
		domain.LastError = err.Error()
		domain.LastErrorAt = &now
		domain.RetryCount++
		s.repo.Update(ctx, domain)
		return
	}

	// Save certificate
	cert.DomainID = domain.ID
	if err := s.repo.SaveCertificate(ctx, cert); err != nil {
		return
	}

	// Update domain
	domain.Status = StatusActive
	domain.SSLStatus = SSLActive
	domain.SSLCertificateID = cert.ID
	domain.SSLExpiresAt = &cert.ExpiresAt
	domain.SSLProvider = cert.Provider
	domain.UpdatedAt = time.Now()
	s.repo.Update(ctx, domain)
}

// GetDomain retrieves a domain by ID
func (s *Service) GetDomain(ctx context.Context, id string) (*Domain, error) {
	return s.repo.GetByID(ctx, id)
}

// ListDomains lists all domains for a tenant
func (s *Service) ListDomains(ctx context.Context, tenantID string) ([]*Domain, error) {
	return s.repo.ListByTenant(ctx, tenantID)
}

// SetPrimary sets a domain as primary
func (s *Service) SetPrimary(ctx context.Context, domainID string) error {
	domain, err := s.repo.GetByID(ctx, domainID)
	if err != nil {
		return err
	}

	if domain.Status != StatusActive {
		return errors.New("only active domains can be set as primary")
	}

	// Unset other primary domains
	domains, _ := s.repo.ListByTenant(ctx, domain.TenantID)
	for _, d := range domains {
		if d.IsPrimary && d.ID != domainID {
			d.IsPrimary = false
			s.repo.Update(ctx, d)
		}
	}

	domain.IsPrimary = true
	domain.UpdatedAt = time.Now()
	return s.repo.Update(ctx, domain)
}

// DeleteDomain removes a domain
func (s *Service) DeleteDomain(ctx context.Context, domainID string) error {
	domain, err := s.repo.GetByID(ctx, domainID)
	if err != nil {
		return err
	}

	// Delete DNS record if exists
	if domain.CloudflareZoneID != "" && domain.CloudflareDNSID != "" {
		s.dnsProvider.DeleteRecord(ctx, domain.CloudflareZoneID, domain.CloudflareDNSID)
	}

	// Revoke SSL if exists
	if domain.SSLCertificateID != "" {
		s.sslProvider.RevokeCertificate(ctx, domain.SSLCertificateID)
	}

	return s.repo.Delete(ctx, domainID)
}

// ==================== SSL Operations ====================

// RenewSSL renews SSL certificate for a domain
func (s *Service) RenewSSL(ctx context.Context, domainID string) error {
	domain, err := s.repo.GetByID(ctx, domainID)
	if err != nil {
		return err
	}

	if domain.SSLCertificateID == "" {
		return s.provisionSSLSync(ctx, domain)
	}

	cert, err := s.sslProvider.RenewCertificate(ctx, domain.SSLCertificateID)
	if err != nil {
		return err
	}

	cert.DomainID = domain.ID
	if err := s.repo.SaveCertificate(ctx, cert); err != nil {
		return err
	}

	domain.SSLCertificateID = cert.ID
	domain.SSLExpiresAt = &cert.ExpiresAt
	domain.SSLStatus = SSLActive
	domain.UpdatedAt = time.Now()

	return s.repo.Update(ctx, domain)
}

func (s *Service) provisionSSLSync(ctx context.Context, domain *Domain) error {
	cert, err := s.sslProvider.ProvisionCertificate(ctx, domain.Domain)
	if err != nil {
		return err
	}

	cert.DomainID = domain.ID
	if err := s.repo.SaveCertificate(ctx, cert); err != nil {
		return err
	}

	domain.SSLCertificateID = cert.ID
	domain.SSLExpiresAt = &cert.ExpiresAt
	domain.SSLStatus = SSLActive
	domain.SSLProvider = cert.Provider
	domain.UpdatedAt = time.Now()

	return s.repo.Update(ctx, domain)
}

// CheckExpiringCertificates checks and renews expiring certificates
func (s *Service) CheckExpiringCertificates(ctx context.Context) error {
	// Get certificates expiring in 30 days
	certs, err := s.repo.ListExpiringCertificates(ctx, 30)
	if err != nil {
		return err
	}

	for _, cert := range certs {
		domain, err := s.repo.GetByID(ctx, cert.DomainID)
		if err != nil {
			continue
		}

		if !domain.SSLAutoRenew {
			continue
		}

		// Renew
		s.RenewSSL(ctx, domain.ID)
	}

	return nil
}

// GetCertificate retrieves SSL certificate details
func (s *Service) GetCertificate(ctx context.Context, domain string) (*SSLCertificate, error) {
	return s.repo.GetCertificateByDomain(ctx, domain)
}

// ==================== Helper Functions ====================

func generateDomainID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "dom_" + hex.EncodeToString(b)
}

func generateVerificationToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "shop-verify-" + hex.EncodeToString(b)
}

func isValidSubdomain(subdomain string) bool {
	re := regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)
	return re.MatchString(strings.ToLower(subdomain))
}

func isValidDomain(domain string) bool {
	// Basic domain validation
	re := regexp.MustCompile(`^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$`)
	return re.MatchString(strings.ToLower(domain))
}

// IsSubdomain checks if domain is a platform subdomain
func (s *Service) IsSubdomain(domain string) bool {
	return strings.HasSuffix(domain, "."+s.platformDomain)
}
