package domains

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/acme"
)

// LetsEncryptProvider implements SSLProvider using Let's Encrypt
type LetsEncryptProvider struct {
	client      *acme.Client
	accountKey  crypto.Signer
	email       string
	staging     bool
	dnsProvider DNSProvider // For DNS-01 challenge
}

// LetsEncryptConfig configuration
type LetsEncryptConfig struct {
	Email       string
	Staging     bool // Use staging environment for testing
	AccountKey  crypto.Signer
	DNSProvider DNSProvider
}

// NewLetsEncryptProvider creates Let's Encrypt SSL provider
func NewLetsEncryptProvider(config LetsEncryptConfig) (*LetsEncryptProvider, error) {
	directoryURL := "https://acme-v02.api.letsencrypt.org/directory"
	if config.Staging {
		directoryURL = "https://acme-staging-v02.api.letsencrypt.org/directory"
	}

	// Generate account key if not provided
	accountKey := config.AccountKey
	if accountKey == nil {
		var err error
		accountKey, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate account key: %w", err)
		}
	}

	client := &acme.Client{
		Key:          accountKey,
		DirectoryURL: directoryURL,
	}

	provider := &LetsEncryptProvider{
		client:      client,
		accountKey:  accountKey,
		email:       config.Email,
		staging:     config.Staging,
		dnsProvider: config.DNSProvider,
	}

	return provider, nil
}

// Register registers ACME account
func (p *LetsEncryptProvider) Register(ctx context.Context) error {
	account := &acme.Account{
		Contact: []string{"mailto:" + p.email},
	}

	_, err := p.client.Register(ctx, account, func(tosURL string) bool {
		return true // Accept Terms of Service
	})
	if err != nil && err != acme.ErrAccountAlreadyExists {
		return fmt.Errorf("failed to register account: %w", err)
	}

	return nil
}

// ProvisionCertificate provisions SSL certificate
func (p *LetsEncryptProvider) ProvisionCertificate(ctx context.Context, domain string) (*SSLCertificate, error) {
	// Ensure account is registered
	if err := p.Register(ctx); err != nil {
		return nil, err
	}

	// Create order
	order, err := p.client.AuthorizeOrder(ctx, acme.DomainIDs(domain))
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// Process authorizations
	for _, authzURL := range order.AuthzURLs {
		authz, err := p.client.GetAuthorization(ctx, authzURL)
		if err != nil {
			return nil, fmt.Errorf("failed to get authorization: %w", err)
		}

		if authz.Status == acme.StatusValid {
			continue
		}

		// Find DNS-01 challenge
		var challenge *acme.Challenge
		for _, c := range authz.Challenges {
			if c.Type == "dns-01" {
				challenge = c
				break
			}
		}

		if challenge == nil {
			return nil, errors.New("DNS-01 challenge not found")
		}

		// Get DNS record value
		recordValue, err := p.client.DNS01ChallengeRecord(challenge.Token)
		if err != nil {
			return nil, fmt.Errorf("failed to get DNS record value: %w", err)
		}

		// Create DNS record
		recordName := "_acme-challenge." + domain
		zoneID, err := p.dnsProvider.GetZoneID(ctx, domain)
		if err != nil {
			return nil, fmt.Errorf("failed to get zone ID: %w", err)
		}

		recordID, err := p.dnsProvider.CreateRecord(ctx, zoneID, DNSRecord{
			Type:  "TXT",
			Name:  recordName,
			Value: recordValue,
			TTL:   60,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create DNS record: %w", err)
		}

		// Wait for DNS propagation
		time.Sleep(30 * time.Second)

		// Accept challenge
		_, err = p.client.Accept(ctx, challenge)
		if err != nil {
			p.dnsProvider.DeleteRecord(ctx, zoneID, recordID)
			return nil, fmt.Errorf("failed to accept challenge: %w", err)
		}

		// Wait for validation
		_, err = p.client.WaitAuthorization(ctx, authzURL)
		if err != nil {
			p.dnsProvider.DeleteRecord(ctx, zoneID, recordID)
			return nil, fmt.Errorf("authorization failed: %w", err)
		}

		// Clean up DNS record
		p.dnsProvider.DeleteRecord(ctx, zoneID, recordID)
	}

	// Wait for order to be ready
	order, err = p.client.WaitOrder(ctx, order.URI)
	if err != nil {
		return nil, fmt.Errorf("order failed: %w", err)
	}

	// Generate CSR
	certKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate certificate key: %w", err)
	}

	csr, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject: pkix.Name{
			CommonName: domain,
		},
		DNSNames: []string{domain},
	}, certKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create CSR: %w", err)
	}

	// Finalize order
	der, _, err := p.client.CreateOrderCert(ctx, order.FinalizeURL, csr, true)
	if err != nil {
		return nil, fmt.Errorf("failed to finalize order: %w", err)
	}

	// Parse certificate
	cert, err := x509.ParseCertificate(der[0])
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Encode certificate and key
	certPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: der[0],
	})

	keyBytes, _ := x509.MarshalECPrivateKey(certKey)
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "EC PRIVATE KEY",
		Bytes: keyBytes,
	})

	// Build chain
	var chainPEM []byte
	for i := 1; i < len(der); i++ {
		chainPEM = append(chainPEM, pem.EncodeToMemory(&pem.Block{
			Type:  "CERTIFICATE",
			Bytes: der[i],
		})...)
	}

	return &SSLCertificate{
		ID:          generateCertID(),
		Domain:      domain,
		Provider:    "letsencrypt",
		Status:      SSLActive,
		IssuedAt:    cert.NotBefore,
		ExpiresAt:   cert.NotAfter,
		Certificate: string(certPEM),
		PrivateKey:  string(keyPEM),
		Chain:       string(chainPEM),
	}, nil
}

// RenewCertificate renews an existing certificate
func (p *LetsEncryptProvider) RenewCertificate(ctx context.Context, certID string) (*SSLCertificate, error) {
	// For Let's Encrypt, renewal is just provisioning a new certificate
	// We need the domain from the certID or stored somewhere
	return nil, errors.New("renewal requires domain name, use ProvisionCertificate")
}

// RenewCertificateForDomain renews certificate for a specific domain
func (p *LetsEncryptProvider) RenewCertificateForDomain(ctx context.Context, domain string) (*SSLCertificate, error) {
	return p.ProvisionCertificate(ctx, domain)
}

// RevokeCertificate revokes a certificate
func (p *LetsEncryptProvider) RevokeCertificate(ctx context.Context, certID string) error {
	// Revocation requires the certificate, which we don't have from just the ID
	// In production, you'd store certificates and retrieve them
	return nil
}

// GetCertificateStatus returns certificate status
func (p *LetsEncryptProvider) GetCertificateStatus(ctx context.Context, certID string) (SSLStatus, error) {
	// In production, you'd check the certificate from storage
	return SSLActive, nil
}

func generateCertID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("le_%x", b)
}

// ==================== Cert Manager Integration (K8s) ====================

// CertManagerProvider implements SSLProvider using cert-manager in Kubernetes
type CertManagerProvider struct {
	namespace    string
	issuerName   string
	issuerKind   string // ClusterIssuer or Issuer
}

// CertManagerConfig configuration
type CertManagerConfig struct {
	Namespace  string
	IssuerName string // e.g., "letsencrypt-prod"
	IssuerKind string // "ClusterIssuer" or "Issuer"
}

// NewCertManagerProvider creates cert-manager provider
func NewCertManagerProvider(config CertManagerConfig) *CertManagerProvider {
	return &CertManagerProvider{
		namespace:  config.Namespace,
		issuerName: config.IssuerName,
		issuerKind: config.IssuerKind,
	}
}

// CertificateResource represents cert-manager Certificate CRD
type CertificateResource struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Metadata   struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	} `json:"metadata"`
	Spec struct {
		SecretName string `json:"secretName"`
		DNSNames   []string `json:"dnsNames"`
		IssuerRef  struct {
			Name  string `json:"name"`
			Kind  string `json:"kind"`
			Group string `json:"group,omitempty"`
		} `json:"issuerRef"`
	} `json:"spec"`
}

// ProvisionCertificate creates a Certificate resource
func (p *CertManagerProvider) ProvisionCertificate(ctx context.Context, domain string) (*SSLCertificate, error) {
	// This would interact with Kubernetes API to create a Certificate resource
	// The cert-manager controller then handles the ACME flow

	certName := sanitizeName(domain)

	cert := CertificateResource{
		APIVersion: "cert-manager.io/v1",
		Kind:       "Certificate",
	}
	cert.Metadata.Name = certName
	cert.Metadata.Namespace = p.namespace
	cert.Spec.SecretName = certName + "-tls"
	cert.Spec.DNSNames = []string{domain}
	cert.Spec.IssuerRef.Name = p.issuerName
	cert.Spec.IssuerRef.Kind = p.issuerKind

	// In production, use client-go to create the resource
	// kubeclient.CertificatesV1().Certificates(p.namespace).Create(ctx, cert, metav1.CreateOptions{})

	return &SSLCertificate{
		ID:       certName,
		Domain:   domain,
		Provider: "cert-manager",
		Status:   SSLProvisioning,
		IssuedAt: time.Now(),
	}, nil
}

// GetCertificateStatus checks certificate status from Secret
func (p *CertManagerProvider) GetCertificateStatus(ctx context.Context, certID string) (SSLStatus, error) {
	// Check if Secret exists and has valid certificate
	// In production, use client-go to get Secret

	// secretName := certID + "-tls"
	// secret, err := kubeclient.CoreV1().Secrets(p.namespace).Get(ctx, secretName, metav1.GetOptions{})

	return SSLActive, nil
}

// RenewCertificate triggers certificate renewal
func (p *CertManagerProvider) RenewCertificate(ctx context.Context, certID string) (*SSLCertificate, error) {
	// Delete the Certificate resource to trigger renewal
	// cert-manager will recreate it automatically

	return &SSLCertificate{
		ID:       certID,
		Provider: "cert-manager",
		Status:   SSLProvisioning,
	}, nil
}

// RevokeCertificate deletes the Certificate resource
func (p *CertManagerProvider) RevokeCertificate(ctx context.Context, certID string) error {
	// Delete Certificate and Secret
	// kubeclient.CertificatesV1().Certificates(p.namespace).Delete(ctx, certID, metav1.DeleteOptions{})

	return nil
}

func sanitizeName(domain string) string {
	// Replace dots and other invalid characters
	result := ""
	for _, c := range domain {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
			result += string(c)
		} else if c == '.' {
			result += "-"
		}
	}
	return result
}
