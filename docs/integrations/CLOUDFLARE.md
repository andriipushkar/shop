# Cloudflare Integration

Інтеграція з Cloudflare для CDN, DNS, безпеки та edge computing.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE INTEGRATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Client   │──▶│ Cloudflare   │──▶│ Cloudflare   │──▶│ Origin       │    │
│  │          │   │ Edge (DNS)   │   │ WAF/CDN      │   │ Servers      │    │
│  └──────────┘   └──────────────┘   └──────────────┘   └──────────────┘    │
│                        │                   │                               │
│                        ▼                   ▼                               │
│              ┌──────────────┐    ┌──────────────┐                         │
│              │ DDoS         │    │ Cache        │                         │
│              │ Protection   │    │ (Static/API) │                         │
│              └──────────────┘    └──────────────┘                         │
│                                                                              │
│  Services Used:                                                             │
│  ├── DNS Management                                                         │
│  ├── CDN & Caching                                                          │
│  ├── WAF (Web Application Firewall)                                        │
│  ├── DDoS Protection                                                        │
│  ├── SSL/TLS                                                                │
│  ├── Workers (Edge Functions)                                               │
│  └── R2 (Object Storage)                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Cloudflare API
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_ACCOUNT_ID=your_account_id

# R2 Storage
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret
CLOUDFLARE_R2_BUCKET=shop-storage
CLOUDFLARE_R2_ENDPOINT=https://account_id.r2.cloudflarestorage.com
```

### Go Configuration

```go
// config/cloudflare.go
type CloudflareConfig struct {
    APIToken    string `env:"CLOUDFLARE_API_TOKEN,required"`
    ZoneID      string `env:"CLOUDFLARE_ZONE_ID,required"`
    AccountID   string `env:"CLOUDFLARE_ACCOUNT_ID,required"`
    R2AccessKey string `env:"CLOUDFLARE_R2_ACCESS_KEY_ID"`
    R2Secret    string `env:"CLOUDFLARE_R2_SECRET_ACCESS_KEY"`
    R2Bucket    string `env:"CLOUDFLARE_R2_BUCKET"`
    R2Endpoint  string `env:"CLOUDFLARE_R2_ENDPOINT"`
}
```

## API Client

### Client Implementation

```go
// pkg/cloudflare/client.go
package cloudflare

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Client struct {
    httpClient *http.Client
    baseURL    string
    apiToken   string
    zoneID     string
    accountID  string
}

func NewClient(cfg *CloudflareConfig) *Client {
    return &Client{
        httpClient: &http.Client{Timeout: 30 * time.Second},
        baseURL:    "https://api.cloudflare.com/client/v4",
        apiToken:   cfg.APIToken,
        zoneID:     cfg.ZoneID,
        accountID:  cfg.AccountID,
    }
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
    var bodyReader io.Reader
    if body != nil {
        jsonBody, _ := json.Marshal(body)
        bodyReader = bytes.NewReader(jsonBody)
    }

    req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Authorization", "Bearer "+c.apiToken)
    req.Header.Set("Content-Type", "application/json")

    return c.httpClient.Do(req)
}
```

## Cache Management

### Purge Cache

```go
// PurgeCache purges cached content
func (c *Client) PurgeCache(ctx context.Context, urls []string) error {
    body := map[string]interface{}{
        "files": urls,
    }

    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/zones/%s/purge_cache", c.zoneID), body)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("purge failed: %d", resp.StatusCode)
    }

    return nil
}

// PurgeByTags purges cache by Cache-Tag headers
func (c *Client) PurgeByTags(ctx context.Context, tags []string) error {
    body := map[string]interface{}{
        "tags": tags,
    }

    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/zones/%s/purge_cache", c.zoneID), body)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}

// PurgeAll purges entire cache
func (c *Client) PurgeAll(ctx context.Context) error {
    body := map[string]interface{}{
        "purge_everything": true,
    }

    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/zones/%s/purge_cache", c.zoneID), body)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}
```

### Cache Tag Integration

```go
// services/core/internal/cdn/service.go
type CDNService struct {
    cloudflare *cloudflare.Client
}

// InvalidateProduct purges product-related cache
func (s *CDNService) InvalidateProduct(ctx context.Context, productID string) error {
    tags := []string{
        fmt.Sprintf("product-%s", productID),
        "products-list",
    }
    return s.cloudflare.PurgeByTags(ctx, tags)
}

// InvalidateCategory purges category-related cache
func (s *CDNService) InvalidateCategory(ctx context.Context, categoryID string) error {
    tags := []string{
        fmt.Sprintf("category-%s", categoryID),
        "categories-list",
    }
    return s.cloudflare.PurgeByTags(ctx, tags)
}

// Set cache tags in response
func setCacheTags(w http.ResponseWriter, tags ...string) {
    w.Header().Set("Cache-Tag", strings.Join(tags, ","))
}
```

## DNS Management

### DNS Records

```go
// CreateDNSRecord creates a new DNS record
func (c *Client) CreateDNSRecord(ctx context.Context, record *DNSRecord) error {
    resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/zones/%s/dns_records", c.zoneID), record)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}

// UpdateDNSRecord updates an existing DNS record
func (c *Client) UpdateDNSRecord(ctx context.Context, recordID string, record *DNSRecord) error {
    resp, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/zones/%s/dns_records/%s", c.zoneID, recordID), record)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}

// DeleteDNSRecord deletes a DNS record
func (c *Client) DeleteDNSRecord(ctx context.Context, recordID string) error {
    resp, err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/zones/%s/dns_records/%s", c.zoneID, recordID))
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}

type DNSRecord struct {
    Type     string `json:"type"`     // A, AAAA, CNAME, TXT, etc.
    Name     string `json:"name"`     // subdomain or @
    Content  string `json:"content"`  // IP or value
    TTL      int    `json:"ttl"`      // 1 = auto
    Proxied  bool   `json:"proxied"`  // through Cloudflare
    Priority int    `json:"priority"` // for MX records
}
```

### Multi-tenant DNS

```go
// TenantDNSService manages DNS for tenant custom domains
type TenantDNSService struct {
    cloudflare *cloudflare.Client
}

// SetupCustomDomain creates DNS records for tenant's custom domain
func (s *TenantDNSService) SetupCustomDomain(ctx context.Context, tenantID, domain string) error {
    // Create CNAME record pointing to main domain
    record := &DNSRecord{
        Type:    "CNAME",
        Name:    domain,
        Content: "shop.ua",
        TTL:     1,
        Proxied: true,
    }

    if err := s.cloudflare.CreateDNSRecord(ctx, record); err != nil {
        return fmt.Errorf("create DNS record: %w", err)
    }

    // Create SSL certificate
    return s.cloudflare.CreateSSLCertificate(ctx, domain)
}
```

## R2 Storage

### R2 Client

```go
// pkg/cloudflare/r2.go
package cloudflare

import (
    "context"
    "io"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/s3"
)

type R2Client struct {
    client *s3.Client
    bucket string
}

func NewR2Client(cfg *CloudflareConfig) (*R2Client, error) {
    r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
        return aws.Endpoint{
            URL: cfg.R2Endpoint,
        }, nil
    })

    awsCfg, err := config.LoadDefaultConfig(context.Background(),
        config.WithEndpointResolverWithOptions(r2Resolver),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            cfg.R2AccessKey,
            cfg.R2Secret,
            "",
        )),
        config.WithRegion("auto"),
    )
    if err != nil {
        return nil, err
    }

    return &R2Client{
        client: s3.NewFromConfig(awsCfg),
        bucket: cfg.R2Bucket,
    }, nil
}

// Upload uploads a file to R2
func (c *R2Client) Upload(ctx context.Context, key string, body io.Reader, contentType string) error {
    _, err := c.client.PutObject(ctx, &s3.PutObjectInput{
        Bucket:      aws.String(c.bucket),
        Key:         aws.String(key),
        Body:        body,
        ContentType: aws.String(contentType),
    })
    return err
}

// Download downloads a file from R2
func (c *R2Client) Download(ctx context.Context, key string) (io.ReadCloser, error) {
    result, err := c.client.GetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(c.bucket),
        Key:    aws.String(key),
    })
    if err != nil {
        return nil, err
    }
    return result.Body, nil
}

// Delete deletes a file from R2
func (c *R2Client) Delete(ctx context.Context, key string) error {
    _, err := c.client.DeleteObject(ctx, &s3.DeleteObjectInput{
        Bucket: aws.String(c.bucket),
        Key:    aws.String(key),
    })
    return err
}

// GetURL returns public URL for a file
func (c *R2Client) GetURL(key string) string {
    return fmt.Sprintf("https://cdn.shop.ua/%s", key)
}
```

### Image Storage Service

```go
// services/core/internal/storage/images.go
type ImageStorage struct {
    r2 *cloudflare.R2Client
}

// UploadProductImage uploads a product image
func (s *ImageStorage) UploadProductImage(ctx context.Context, productID string, image io.Reader, filename string) (string, error) {
    // Generate key
    ext := filepath.Ext(filename)
    key := fmt.Sprintf("products/%s/%s%s", productID, uuid.New().String(), ext)

    // Detect content type
    contentType := mime.TypeByExtension(ext)
    if contentType == "" {
        contentType = "image/jpeg"
    }

    // Upload
    if err := s.r2.Upload(ctx, key, image, contentType); err != nil {
        return "", err
    }

    return s.r2.GetURL(key), nil
}
```

## Cloudflare Workers

### Edge Function for Image Resizing

```javascript
// workers/image-resize.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Parse resize parameters
    const width = url.searchParams.get('w');
    const height = url.searchParams.get('h');
    const quality = url.searchParams.get('q') || 80;

    // Get original image
    const originalUrl = url.pathname.replace('/cdn/', '');
    const imageRequest = new Request(`${env.R2_BUCKET_URL}/${originalUrl}`);

    // Use Cloudflare Image Resizing
    const options = {
      cf: {
        image: {
          width: width ? parseInt(width) : undefined,
          height: height ? parseInt(height) : undefined,
          quality: parseInt(quality),
          fit: 'contain',
          format: 'webp',
        },
      },
    };

    return fetch(imageRequest, options);
  },
};
```

### Edge Function for Geolocation

```javascript
// workers/geo-redirect.js
export default {
  async fetch(request, env) {
    const country = request.cf?.country || 'UA';

    // Redirect based on country
    if (country === 'UA') {
      return fetch(request);
    }

    // Show "Ukraine only" page for other countries
    return new Response('This store is available only in Ukraine', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
```

## WAF Rules

### Custom WAF Rules

```go
// CreateWAFRule creates a custom WAF rule
func (c *Client) CreateWAFRule(ctx context.Context, rule *WAFRule) error {
    resp, err := c.doRequest(ctx, "POST",
        fmt.Sprintf("/zones/%s/firewall/rules", c.zoneID), rule)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}

type WAFRule struct {
    Filter      WAFFilter `json:"filter"`
    Action      string    `json:"action"` // block, challenge, allow
    Description string    `json:"description"`
    Priority    int       `json:"priority"`
}

type WAFFilter struct {
    Expression string `json:"expression"`
}

// Example rules
func setupWAFRules(client *cloudflare.Client) {
    ctx := context.Background()

    // Block known bad bots
    client.CreateWAFRule(ctx, &WAFRule{
        Filter: WAFFilter{
            Expression: `(cf.client.bot) and not (cf.bot_management.verified_bot)`,
        },
        Action:      "block",
        Description: "Block unverified bots",
    })

    // Rate limit login attempts
    client.CreateWAFRule(ctx, &WAFRule{
        Filter: WAFFilter{
            Expression: `(http.request.uri.path contains "/api/auth/login")`,
        },
        Action:      "challenge",
        Description: "Challenge login requests",
    })

    // Block SQL injection attempts
    client.CreateWAFRule(ctx, &WAFRule{
        Filter: WAFFilter{
            Expression: `(http.request.uri.query contains "UNION SELECT" or http.request.uri.query contains "1=1")`,
        },
        Action:      "block",
        Description: "Block SQL injection",
    })
}
```

## Page Rules

### Terraform Configuration

```hcl
# terraform/cloudflare.tf

resource "cloudflare_page_rule" "static_assets" {
  zone_id  = var.cloudflare_zone_id
  target   = "shop.ua/static/*"
  priority = 1

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 2592000  # 30 days
    browser_cache_ttl = 31536000  # 1 year
  }
}

resource "cloudflare_page_rule" "api_cache" {
  zone_id  = var.cloudflare_zone_id
  target   = "shop.ua/api/v1/products*"
  priority = 2

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 300  # 5 minutes
    cache_key_fields {
      query_string {
        include = ["category", "sort", "page", "limit"]
      }
    }
  }
}

resource "cloudflare_page_rule" "no_cache_auth" {
  zone_id  = var.cloudflare_zone_id
  target   = "shop.ua/api/v1/auth/*"
  priority = 3

  actions {
    cache_level = "bypass"
    disable_security = false
  }
}
```

## Analytics

### Get Zone Analytics

```go
// GetAnalytics retrieves zone analytics
func (c *Client) GetAnalytics(ctx context.Context, since time.Time) (*Analytics, error) {
    path := fmt.Sprintf("/zones/%s/analytics/dashboard?since=%s",
        c.zoneID,
        since.Format(time.RFC3339),
    )

    resp, err := c.doRequest(ctx, "GET", path, nil)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Result Analytics `json:"result"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return &result.Result, nil
}

type Analytics struct {
    Totals struct {
        Requests         int64 `json:"requests"`
        Bandwidth        int64 `json:"bandwidth"`
        PageViews        int64 `json:"pageviews"`
        UniqueVisitors   int64 `json:"uniques"`
        Threats          int64 `json:"threats"`
        CachedRequests   int64 `json:"cached"`
        UncachedRequests int64 `json:"uncached"`
    } `json:"totals"`
}
```

## Monitoring

### Metrics

```go
var (
    cachePurges = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "cloudflare_cache_purges_total",
            Help: "Cache purge operations",
        },
        []string{"type", "status"},
    )

    r2Operations = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "cloudflare_r2_operations_total",
            Help: "R2 storage operations",
        },
        []string{"operation", "status"},
    )
)
```

### Alerts

```yaml
groups:
  - name: cloudflare
    rules:
      - alert: HighCacheMissRate
        expr: cloudflare_cache_miss_rate > 0.5
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High Cloudflare cache miss rate"

      - alert: WAFBlockedRequests
        expr: rate(cloudflare_waf_blocked_total[5m]) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of WAF blocked requests"
```

## See Also

- [Caching Strategy](../architecture/CACHING_STRATEGY.md)
- [Storage Module](../modules/STORAGE.md)
- [Security](../compliance/SECURITY.md)
