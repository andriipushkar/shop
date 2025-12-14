# Domain Management Documentation

## Overview

Domain Management enables tenants to use custom domains for their stores with automatic SSL certificate provisioning via Let's Encrypt and DNS automation through Cloudflare.

## Features

- **Custom Domains**: Use your own domain (e.g., mystore.com)
- **Subdomains**: Automatic subdomains (e.g., mystore.shop.com)
- **SSL Automation**: Free SSL certificates via Let's Encrypt
- **DNS Management**: Automatic DNS configuration via Cloudflare
- **Certificate Renewal**: Automatic renewal before expiration

## Domain Types

| Type | Example | SSL | DNS |
|------|---------|-----|-----|
| Subdomain | mystore.shop.com | Wildcard | Automatic |
| Custom | mystore.com | Per-domain | Manual/Auto |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Domain Management                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Domains    │  │     SSL      │  │       DNS        │  │
│  │   Service    │  │   Provider   │  │     Provider     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                 │                   │             │
│         │     ┌───────────┴───────────┐      │             │
│         │     │                       │      │             │
│         ▼     ▼                       ▼      ▼             │
│  ┌─────────────────┐         ┌─────────────────────┐       │
│  │  Let's Encrypt  │         │     Cloudflare      │       │
│  │  / cert-manager │         │        API          │       │
│  └─────────────────┘         └─────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Add Subdomain

```
POST /api/v1/domains/subdomain
Authorization: Bearer {token}
Content-Type: application/json

{
  "subdomain": "mystore"
}
```

Response:
```json
{
  "id": "dom_abc123",
  "domain": "mystore.shop.com",
  "type": "subdomain",
  "status": "active",
  "ssl_status": "active",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Add Custom Domain

```
POST /api/v1/domains/custom
Authorization: Bearer {token}
Content-Type: application/json

{
  "domain": "mystore.com"
}
```

Response:
```json
{
  "id": "dom_xyz789",
  "domain": "mystore.com",
  "type": "custom",
  "status": "pending_verification",
  "ssl_status": "pending",
  "verification": {
    "type": "CNAME",
    "name": "_verification.mystore.com",
    "value": "verify.shop.com"
  },
  "dns_records": [
    {
      "type": "CNAME",
      "name": "mystore.com",
      "value": "proxy.shop.com"
    },
    {
      "type": "CNAME",
      "name": "www.mystore.com",
      "value": "proxy.shop.com"
    }
  ],
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Verify Domain

```
POST /api/v1/domains/{domain_id}/verify
Authorization: Bearer {token}
```

### List Domains

```
GET /api/v1/domains
Authorization: Bearer {token}
```

### Set Primary Domain

```
POST /api/v1/domains/{domain_id}/primary
Authorization: Bearer {token}
```

### Delete Domain

```
DELETE /api/v1/domains/{domain_id}
Authorization: Bearer {token}
```

## SSL Certificate Providers

### Let's Encrypt (Direct)

For standalone deployments:

```go
provider, err := domains.NewLetsEncryptProvider(domains.LetsEncryptConfig{
    Email:       "admin@shop.com",
    Staging:     false, // Use production
    DNSProvider: cloudflareProvider,
})

cert, err := provider.ProvisionCertificate(ctx, "mystore.com")
```

### cert-manager (Kubernetes)

For Kubernetes deployments:

```go
provider := domains.NewCertManagerProvider(domains.CertManagerConfig{
    Namespace:  "shop-platform",
    IssuerName: "letsencrypt-prod",
    IssuerKind: "ClusterIssuer",
})

cert, err := provider.ProvisionCertificate(ctx, "mystore.com")
```

## DNS Providers

### Cloudflare

```go
dnsProvider := domains.NewCloudflareProvider("your-api-token")

// Create DNS record
recordID, err := dnsProvider.CreateRecord(ctx, zoneID, domains.DNSRecord{
    Type:  "CNAME",
    Name:  "mystore.com",
    Value: "proxy.shop.com",
    TTL:   300,
})
```

### Cloudflare SSL for SaaS

For advanced SSL management:

```go
sslProvider := domains.NewCloudflareSSLProvider(domains.CloudflareSSLConfig{
    APIToken: "your-token",
    ZoneID:   "zone-id",
})

cert, err := sslProvider.ProvisionCertificate(ctx, "mystore.com")
```

## Domain Verification

### CNAME Verification

1. Add DNS record: `_verification.mystore.com -> verify.shop.com`
2. Call verify endpoint
3. System checks DNS propagation
4. Domain marked as verified

### HTTP Verification (Alternative)

1. Upload file to `/.well-known/acme-challenge/{token}`
2. System verifies file content
3. Domain marked as verified

## SSL Certificate Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Pending   │────▶│ Provisioning│────▶│   Active    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               │ 30 days before expiry
                                               ▼
                                        ┌─────────────┐
                                        │  Renewing   │
                                        └─────────────┘
```

### Automatic Renewal

Certificates are renewed automatically 30 days before expiration:

```go
// Background job runs daily
err := domainService.CheckExpiringCertificates(ctx)
```

## Kubernetes Integration

### cert-manager ClusterIssuer

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@shop.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - dns01:
        cloudflare:
          email: admin@shop.com
          apiTokenSecretRef:
            name: cloudflare-api-token
            key: api-token
```

### Certificate Resource

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: mystore-com
  namespace: shop-platform
spec:
  secretName: mystore-com-tls
  dnsNames:
  - mystore.com
  - www.mystore.com
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
```

### Ingress with TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tenant-mystore
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - mystore.com
    - www.mystore.com
    secretName: mystore-com-tls
  rules:
  - host: mystore.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: storefront
            port:
              number: 80
```

## Domain Status

| Status | Description |
|--------|-------------|
| `pending_verification` | Awaiting DNS verification |
| `verifying` | Verification in progress |
| `provisioning_ssl` | SSL certificate being issued |
| `active` | Domain is fully configured |
| `expired` | SSL certificate expired |
| `error` | Configuration error |

## SSL Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting provisioning |
| `provisioning` | Certificate being issued |
| `active` | Certificate is valid |
| `expiring` | Certificate expires soon |
| `expired` | Certificate has expired |
| `failed` | Provisioning failed |

## Error Handling

| Error | Description | Resolution |
|-------|-------------|------------|
| `domain_taken` | Domain already registered | Use different domain |
| `invalid_domain` | Domain format invalid | Check domain format |
| `dns_not_configured` | DNS records missing | Add required DNS records |
| `verification_failed` | Could not verify ownership | Check DNS propagation |
| `ssl_provisioning_failed` | Certificate issuance failed | Check DNS, retry |

## Best Practices

1. **DNS Propagation**: Wait 5-10 minutes after adding DNS records
2. **WWW Redirect**: Configure both apex and www subdomain
3. **Monitor Certificates**: Set up alerts for expiring certs
4. **Backup Keys**: Securely store private keys
5. **Rate Limits**: Be aware of Let's Encrypt rate limits

## Rate Limits (Let's Encrypt)

| Limit | Value |
|-------|-------|
| Certificates per domain | 50/week |
| Duplicate certificates | 5/week |
| Failed validations | 5/hour |
| New registrations | 500/3 hours |

## Monitoring

### Metrics

- `domains_total` - Total domains by status
- `ssl_certificates_total` - Certificates by status
- `ssl_days_until_expiry` - Days until certificate expiration
- `domain_verification_duration_seconds` - Verification time

### Alerts

| Alert | Condition |
|-------|-----------|
| SSL Expiring Soon | < 7 days until expiry |
| Verification Failed | > 3 consecutive failures |
| High Provisioning Time | > 5 minutes |
