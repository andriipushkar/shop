# Security Hardening Guide

Посилення безпеки production середовища.

## Огляд

| Рівень | Компоненти |
|--------|------------|
| Network | Firewall, VPC, Security Groups |
| Application | Authentication, Authorization, Input Validation |
| Data | Encryption at rest, Encryption in transit |
| Infrastructure | Container security, Secret management |

## Network Security

### VPC Configuration

```terraform
# terraform/vpc.tf
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "shop-vpc"
  }
}

# Private subnets for applications
resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "shop-private-${count.index + 1}"
    Type = "private"
  }
}

# Public subnets for load balancers
resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 101}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "shop-public-${count.index + 1}"
    Type = "public"
  }
}
```

### Security Groups

```terraform
# terraform/security-groups.tf

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "shop-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Application Security Group
resource "aws_security_group" "app" {
  name        = "shop-app-sg"
  description = "Security group for application"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "From ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Database Security Group
resource "aws_security_group" "db" {
  name        = "shop-db-sg"
  description = "Security group for database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from app"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # No egress needed for DB
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Network Policies (Kubernetes)

```yaml
# kubernetes/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-ingress
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: core
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-db-access
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              db-access: "true"
      ports:
        - protocol: TCP
          port: 5432
```

## Application Security

### Security Headers

```go
// middleware/security.go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Prevent clickjacking
        c.Header("X-Frame-Options", "DENY")

        // Prevent MIME sniffing
        c.Header("X-Content-Type-Options", "nosniff")

        // XSS protection
        c.Header("X-XSS-Protection", "1; mode=block")

        // Referrer policy
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

        // Content Security Policy
        c.Header("Content-Security-Policy",
            "default-src 'self'; "+
            "script-src 'self' 'unsafe-inline' https://cdn.yourstore.com; "+
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "+
            "img-src 'self' data: https://cdn.yourstore.com; "+
            "font-src 'self' https://fonts.gstatic.com; "+
            "connect-src 'self' https://api.yourstore.com; "+
            "frame-ancestors 'none'")

        // HSTS
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

        // Permissions Policy
        c.Header("Permissions-Policy",
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "+
            "magnetometer=(), microphone=(), payment=(), usb=()")

        c.Next()
    }
}
```

### Input Validation

```go
// pkg/validator/validator.go
import (
    "github.com/go-playground/validator/v10"
    "html"
    "regexp"
)

var (
    validate = validator.New()

    // Regex patterns
    phoneRegex = regexp.MustCompile(`^\+380\d{9}$`)
    slugRegex  = regexp.MustCompile(`^[a-z0-9-]+$`)
)

// Custom validators
func init() {
    validate.RegisterValidation("phone_ua", validatePhoneUA)
    validate.RegisterValidation("slug", validateSlug)
    validate.RegisterValidation("no_html", validateNoHTML)
}

func validatePhoneUA(fl validator.FieldLevel) bool {
    return phoneRegex.MatchString(fl.Field().String())
}

func validateSlug(fl validator.FieldLevel) bool {
    return slugRegex.MatchString(fl.Field().String())
}

func validateNoHTML(fl validator.FieldLevel) bool {
    value := fl.Field().String()
    escaped := html.EscapeString(value)
    return value == escaped
}

// Sanitize HTML
func SanitizeHTML(input string) string {
    p := bluemonday.UGCPolicy()
    return p.Sanitize(input)
}

// Validate and sanitize input
type CreateProductInput struct {
    Name        string  `json:"name" validate:"required,min=1,max=255,no_html"`
    Description string  `json:"description" validate:"max=5000"`
    SKU         string  `json:"sku" validate:"required,alphanum,max=50"`
    Price       float64 `json:"price" validate:"required,gt=0,lt=1000000"`
    Slug        string  `json:"slug" validate:"omitempty,slug,max=255"`
}
```

### SQL Injection Prevention

```go
// ЗАВЖДИ використовуйте параметризовані запити

// Поганий приклад (SQL Injection!)
query := fmt.Sprintf("SELECT * FROM products WHERE name = '%s'", userInput)

// Хороший приклад (Parameterized)
db.Where("name = ?", userInput).Find(&products)

// Хороший приклад (Named parameters)
db.Where("name = @name AND price < @price", sql.Named("name", name), sql.Named("price", price))

// Raw SQL з параметрами
db.Raw("SELECT * FROM products WHERE category_id = ? AND price BETWEEN ? AND ?",
    categoryID, minPrice, maxPrice).Scan(&products)
```

### Rate Limiting

```go
// middleware/ratelimit.go
import "golang.org/x/time/rate"

type RateLimiter struct {
    visitors map[string]*rate.Limiter
    mu       sync.RWMutex
    rate     rate.Limit
    burst    int
}

func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
    return &RateLimiter{
        visitors: make(map[string]*rate.Limiter),
        rate:     r,
        burst:    b,
    }
}

func (rl *RateLimiter) GetLimiter(ip string) *rate.Limiter {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    limiter, exists := rl.visitors[ip]
    if !exists {
        limiter = rate.NewLimiter(rl.rate, rl.burst)
        rl.visitors[ip] = limiter
    }

    return limiter
}

func RateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        limiter := rl.GetLimiter(ip)

        if !limiter.Allow() {
            c.AbortWithStatusJSON(429, gin.H{
                "error": "Too many requests",
                "retry_after": 60,
            })
            return
        }

        c.Next()
    }
}

// Usage
limiter := NewRateLimiter(rate.Limit(100), 200) // 100 req/s, burst 200
router.Use(RateLimitMiddleware(limiter))
```

## Data Security

### Encryption at Rest

```terraform
# terraform/rds.tf
resource "aws_db_instance" "main" {
  identifier        = "shop-db"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.r6g.large"
  allocated_storage = 100

  # Encryption
  storage_encrypted = true
  kms_key_id        = aws_kms_key.db.arn

  # Other settings
  db_name  = "shopdb"
  username = "shop"
  password = random_password.db.result

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  # Backup
  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Logging
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  skip_final_snapshot = false
  final_snapshot_identifier = "shop-db-final-snapshot"
}

# KMS Key for encryption
resource "aws_kms_key" "db" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}
```

### Encryption in Transit (TLS)

```go
// TLS configuration
func NewTLSConfig() *tls.Config {
    return &tls.Config{
        MinVersion: tls.VersionTLS12,
        CipherSuites: []uint16{
            tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
            tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
            tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
        },
        PreferServerCipherSuites: true,
        CurvePreferences: []tls.CurveID{
            tls.X25519,
            tls.CurveP256,
        },
    }
}

// Database connection with SSL
dsn := "host=db.example.com user=shop password=xxx dbname=shopdb sslmode=verify-full sslrootcert=/etc/ssl/certs/rds-ca.pem"
```

### Field-Level Encryption

```go
// pkg/encryption/encryption.go
import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
)

type Encryptor struct {
    key []byte
}

func NewEncryptor(key string) *Encryptor {
    // Key must be 32 bytes for AES-256
    keyBytes := sha256.Sum256([]byte(key))
    return &Encryptor{key: keyBytes[:]}
}

func (e *Encryptor) Encrypt(plaintext string) (string, error) {
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonce := make([]byte, gcm.NonceSize())
    if _, err := rand.Read(nonce); err != nil {
        return "", err
    }

    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (e *Encryptor) Decrypt(ciphertext string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }

    block, err := aes.NewCipher(e.key)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonceSize := gcm.NonceSize()
    nonce, cipherBytes := data[:nonceSize], data[nonceSize:]

    plaintext, err := gcm.Open(nil, nonce, cipherBytes, nil)
    if err != nil {
        return "", err
    }

    return string(plaintext), nil
}

// Usage for sensitive fields
type Customer struct {
    ID              string
    Email           string
    PhoneEncrypted  string // Encrypted
    CardLastFour    string // Only last 4 digits
}
```

## Secret Management

### AWS Secrets Manager

```go
// pkg/secrets/aws.go
import (
    "github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type SecretManager struct {
    client *secretsmanager.Client
    cache  map[string]cachedSecret
    mu     sync.RWMutex
}

type cachedSecret struct {
    value     string
    expiresAt time.Time
}

func (sm *SecretManager) GetSecret(ctx context.Context, name string) (string, error) {
    // Check cache
    sm.mu.RLock()
    if cached, ok := sm.cache[name]; ok && cached.expiresAt.After(time.Now()) {
        sm.mu.RUnlock()
        return cached.value, nil
    }
    sm.mu.RUnlock()

    // Fetch from AWS
    result, err := sm.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
        SecretId: aws.String(name),
    })
    if err != nil {
        return "", err
    }

    // Cache for 5 minutes
    sm.mu.Lock()
    sm.cache[name] = cachedSecret{
        value:     *result.SecretString,
        expiresAt: time.Now().Add(5 * time.Minute),
    }
    sm.mu.Unlock()

    return *result.SecretString, nil
}
```

### Kubernetes Secrets (Sealed Secrets)

```yaml
# Install kubeseal
# kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Create sealed secret
# kubeseal --format yaml < secret.yaml > sealed-secret.yaml

apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: shop-secrets
  namespace: shop
spec:
  encryptedData:
    DATABASE_PASSWORD: AgBy3i4OJSWK+PiTySYZZA9rO43...
    JWT_PRIVATE_KEY: AgBy3i4OJSWK+PiTySYZZA9rO43...
```

## Container Security

### Dockerfile Best Practices

```dockerfile
# Use specific version, not latest
FROM golang:1.24-alpine AS builder

# Don't run as root
RUN adduser -D -g '' appuser

# Use multi-stage build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Final minimal image
FROM scratch

# Copy CA certificates for HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy user
COPY --from=builder /etc/passwd /etc/passwd

# Copy binary
COPY --from=builder /app/server /server

# Run as non-root
USER appuser

# No shell access
ENTRYPOINT ["/server"]
```

### Pod Security Standards

```yaml
# kubernetes/pod-security.yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault

  containers:
    - name: app
      image: shop/core:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      resources:
        limits:
          cpu: "500m"
          memory: "512Mi"
        requests:
          cpu: "100m"
          memory: "128Mi"
      volumeMounts:
        - name: tmp
          mountPath: /tmp

  volumes:
    - name: tmp
      emptyDir: {}
```

### Image Scanning

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t shop/core:${{ github.sha }} ./services/core

      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'shop/core:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## Audit Logging

```go
// middleware/audit.go
type AuditLog struct {
    ID          string         `json:"id"`
    Timestamp   time.Time      `json:"timestamp"`
    UserID      string         `json:"user_id"`
    TenantID    string         `json:"tenant_id"`
    Action      string         `json:"action"`
    Resource    string         `json:"resource"`
    ResourceID  string         `json:"resource_id"`
    Method      string         `json:"method"`
    Path        string         `json:"path"`
    IP          string         `json:"ip"`
    UserAgent   string         `json:"user_agent"`
    RequestBody json.RawMessage `json:"request_body,omitempty"`
    StatusCode  int            `json:"status_code"`
    Duration    int64          `json:"duration_ms"`
}

func AuditMiddleware(logger *AuditLogger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()

        // Capture request body for mutations
        var requestBody []byte
        if c.Request.Method != "GET" {
            requestBody, _ = io.ReadAll(c.Request.Body)
            c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
        }

        c.Next()

        // Only log mutations and auth events
        if c.Request.Method == "GET" && !strings.Contains(c.Request.URL.Path, "/auth/") {
            return
        }

        user := GetUserFromContext(c)

        log := AuditLog{
            ID:          uuid.New().String(),
            Timestamp:   time.Now(),
            UserID:      user.ID,
            TenantID:    user.TenantID,
            Action:      determineAction(c.Request.Method, c.Request.URL.Path),
            Resource:    extractResource(c.Request.URL.Path),
            ResourceID:  c.Param("id"),
            Method:      c.Request.Method,
            Path:        c.Request.URL.Path,
            IP:          c.ClientIP(),
            UserAgent:   c.GetHeader("User-Agent"),
            RequestBody: sanitizeRequestBody(requestBody),
            StatusCode:  c.Writer.Status(),
            Duration:    time.Since(start).Milliseconds(),
        }

        logger.Log(log)
    }
}

// Mask sensitive data
func sanitizeRequestBody(body []byte) json.RawMessage {
    var data map[string]interface{}
    json.Unmarshal(body, &data)

    sensitiveFields := []string{"password", "card_number", "cvv", "token"}
    for _, field := range sensitiveFields {
        if _, ok := data[field]; ok {
            data[field] = "***REDACTED***"
        }
    }

    sanitized, _ := json.Marshal(data)
    return sanitized
}
```

## Security Checklist

### Network
- [ ] VPC з private subnets
- [ ] Security Groups з мінімальними правилами
- [ ] Network Policies в Kubernetes
- [ ] WAF на ALB

### Application
- [ ] Security headers налаштовані
- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting

### Data
- [ ] Encryption at rest
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Field-level encryption для PII
- [ ] Secure secret management

### Infrastructure
- [ ] Container security (non-root, read-only)
- [ ] Image scanning
- [ ] Pod Security Standards
- [ ] Audit logging

### Compliance
- [ ] GDPR compliance
- [ ] PCI DSS (якщо обробляються картки)
- [ ] Regular security audits
- [ ] Penetration testing
