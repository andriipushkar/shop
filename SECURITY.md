# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.4.x   | :white_check_mark: |
| 1.3.x   | :white_check_mark: |
| 1.2.x   | :x:                |
| < 1.2   | :x:                |

## Reporting a Vulnerability

We take security seriously at Shop Platform. If you discover a security vulnerability, please follow responsible disclosure practices.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security@shop-platform.com with details
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Initial Response**: Within 24 hours
- **Status Update**: Within 72 hours
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Disclosure Policy

- We follow coordinated disclosure
- Credit will be given to reporters (unless anonymity is requested)
- We will not take legal action against researchers acting in good faith

## Security Measures

### Authentication

- JWT tokens with short expiration (15 minutes)
- Refresh token rotation
- bcrypt password hashing (cost factor 12)
- Optional 2FA (TOTP)
- Rate limiting on auth endpoints

### Authorization

- Role-based access control (RBAC)
- Row-level security for multi-tenancy
- API key scoping
- Session management

### Data Protection

- TLS 1.3 for all connections
- AES-256 encryption at rest
- PII data encryption
- Secure secret management (HashiCorp Vault / AWS Secrets Manager)

### Infrastructure

- Network segmentation
- Web Application Firewall (WAF)
- DDoS protection
- Regular security audits
- Automated vulnerability scanning

### Compliance

- GDPR compliant
- PCI DSS for payment processing
- SOC 2 Type II (in progress)

## Security Headers

All API responses include:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

## Vulnerability Disclosure Hall of Fame

We thank the following security researchers for responsibly disclosing vulnerabilities:

- *No reports yet*

## Security Best Practices for Users

### API Keys

- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly
- Use scoped keys with minimum permissions

### Webhooks

- Validate webhook signatures
- Use HTTPS endpoints only
- Implement idempotency

### Data Handling

- Don't store sensitive data unnecessarily
- Implement data retention policies
- Use secure connections

## Contact

- Security Team: security@shop-platform.com
- PGP Key: [Download](https://shop-platform.com/.well-known/security.txt)

## Bug Bounty

We currently do not have a formal bug bounty program, but we appreciate responsible disclosure and may offer rewards for significant findings at our discretion.
