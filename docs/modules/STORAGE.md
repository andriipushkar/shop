# Storage (S3/MinIO)

Система зберігання файлів на базі S3-сумісного сховища.

## Overview

Модуль storage забезпечує:
- Завантаження та зберігання файлів
- Генерація presigned URLs
- Підтримка S3 та MinIO
- Image processing (resize, optimize)
- CDN інтеграція

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │   Upload     │                    │   S3 / MinIO          │  │
│  │   Service    │───────────────────▶│                       │  │
│  └──────────────┘                    │  Buckets:             │  │
│                                      │  - products           │  │
│  ┌──────────────┐                    │  - categories         │  │
│  │   Image      │───────────────────▶│  - uploads            │  │
│  │   Processor  │                    │  - documents          │  │
│  └──────────────┘                    │  - exports            │  │
│                                      └───────────┬───────────┘  │
│                                                   │              │
│                                                   ▼              │
│                                      ┌───────────────────────┐  │
│                                      │   CDN (Cloudflare)    │  │
│                                      │   cdn.shop.ua         │  │
│                                      └───────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

```bash
# S3/MinIO
S3_ENDPOINT=https://s3.amazonaws.com     # or http://minio:9000
S3_REGION=eu-central-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=shop-storage
S3_USE_SSL=true

# CDN
CDN_ENABLED=true
CDN_URL=https://cdn.shop.ua

# Upload limits
UPLOAD_MAX_FILE_SIZE=10485760     # 10MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp,application/pdf

# Image processing
IMAGE_MAX_WIDTH=2000
IMAGE_MAX_HEIGHT=2000
IMAGE_QUALITY=85
IMAGE_FORMAT=webp
```

## Buckets Structure

```
shop-storage/
├── products/
│   ├── {product_id}/
│   │   ├── original/
│   │   │   └── image.jpg
│   │   ├── large/         # 1000x1000
│   │   │   └── image.webp
│   │   ├── medium/        # 500x500
│   │   │   └── image.webp
│   │   └── thumb/         # 200x200
│   │       └── image.webp
│   └── ...
├── categories/
│   └── {category_id}/
│       └── banner.webp
├── uploads/
│   └── temp/
├── documents/
│   └── invoices/
└── exports/
    └── reports/
```

## Usage

### Initialize Storage

```go
import "shop/services/core/internal/storage"

func main() {
    store, err := storage.NewS3Storage(&storage.Config{
        Endpoint:  "s3.amazonaws.com",
        Region:    "eu-central-1",
        AccessKey: os.Getenv("S3_ACCESS_KEY"),
        SecretKey: os.Getenv("S3_SECRET_KEY"),
        Bucket:    "shop-storage",
        UseSSL:    true,
    })
    if err != nil {
        log.Fatal(err)
    }
}
```

### Upload File

```go
// Upload from reader
url, err := store.Upload(ctx, &storage.UploadParams{
    Key:         "products/123/original/photo.jpg",
    Reader:      file,
    ContentType: "image/jpeg",
    ACL:         "public-read",
})

// Upload from bytes
url, err := store.UploadBytes(ctx, &storage.UploadParams{
    Key:         "documents/invoice.pdf",
    Data:        pdfBytes,
    ContentType: "application/pdf",
})
```

### Upload with Image Processing

```go
// Upload and create thumbnails
urls, err := store.UploadProductImage(ctx, &storage.ProductImageParams{
    ProductID: "123",
    Reader:    file,
    Filename:  "photo.jpg",
    Sizes: []storage.ImageSize{
        {Name: "large", Width: 1000, Height: 1000},
        {Name: "medium", Width: 500, Height: 500},
        {Name: "thumb", Width: 200, Height: 200},
    },
    Format:  "webp",
    Quality: 85,
})

// urls = {
//   "original": "https://cdn.shop.ua/products/123/original/photo.jpg",
//   "large": "https://cdn.shop.ua/products/123/large/photo.webp",
//   "medium": "https://cdn.shop.ua/products/123/medium/photo.webp",
//   "thumb": "https://cdn.shop.ua/products/123/thumb/photo.webp",
// }
```

### Get File URL

```go
// Public URL (via CDN)
url := store.GetPublicURL("products/123/large/photo.webp")
// https://cdn.shop.ua/products/123/large/photo.webp

// Presigned URL (for private files)
url, err := store.GetPresignedURL(ctx, "documents/invoice.pdf", 1*time.Hour)
// https://s3.../documents/invoice.pdf?X-Amz-Signature=...
```

### Delete File

```go
// Delete single file
err := store.Delete(ctx, "products/123/original/old-photo.jpg")

// Delete multiple files
err := store.DeleteMany(ctx, []string{
    "products/123/original/photo.jpg",
    "products/123/large/photo.webp",
    "products/123/medium/photo.webp",
    "products/123/thumb/photo.webp",
})

// Delete by prefix
err := store.DeleteByPrefix(ctx, "products/123/")
```

### List Files

```go
files, err := store.List(ctx, &storage.ListParams{
    Prefix:    "products/123/",
    MaxKeys:   100,
    Delimiter: "/",
})

for _, file := range files {
    fmt.Printf("%s (%d bytes)\n", file.Key, file.Size)
}
```

## Image Processing

### Supported Operations

| Operation | Description |
|-----------|-------------|
| Resize | Fit within dimensions |
| Crop | Center crop |
| Format | Convert to webp/jpeg/png |
| Quality | Compression level |
| Blur | Blur placeholder |

### Image Service

```go
import "shop/services/core/internal/storage/images"

processor := images.NewProcessor()

// Resize image
resized, err := processor.Resize(original, 500, 500)

// Convert to WebP
webp, err := processor.Convert(original, "webp", 85)

// Generate blur placeholder
placeholder, err := processor.BlurPlaceholder(original, 20, 20)
```

## API Endpoints

```
POST   /api/v1/upload                 # Upload file
POST   /api/v1/upload/image           # Upload and process image
GET    /api/v1/files/:key             # Get file info
DELETE /api/v1/files/:key             # Delete file
GET    /api/v1/files/presign/:key     # Get presigned URL

# Product images
POST   /api/v1/products/:id/images    # Upload product image
DELETE /api/v1/products/:id/images/:imageId  # Delete image
PUT    /api/v1/products/:id/images/reorder   # Reorder images
```

### Upload Request

```bash
curl -X POST \
  -F "file=@photo.jpg" \
  -F "folder=products/123" \
  https://api.shop.ua/api/v1/upload
```

### Response

```json
{
  "url": "https://cdn.shop.ua/products/123/photo.webp",
  "key": "products/123/photo.webp",
  "size": 45678,
  "content_type": "image/webp",
  "variants": {
    "large": "https://cdn.shop.ua/products/123/large/photo.webp",
    "medium": "https://cdn.shop.ua/products/123/medium/photo.webp",
    "thumb": "https://cdn.shop.ua/products/123/thumb/photo.webp"
  }
}
```

## CDN Integration

### Cloudflare Configuration

```bash
# Cloudflare
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_token
CDN_DOMAIN=cdn.shop.ua
```

### Cache Purge

```go
// Purge single URL
err := cdn.PurgeURL("https://cdn.shop.ua/products/123/photo.webp")

// Purge by prefix
err := cdn.PurgePrefix("products/123/")

// Purge everything
err := cdn.PurgeAll()
```

## Docker Compose (MinIO)

```yaml
services:
  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  minio_data:
```

## Best Practices

1. **Unique keys** - Use UUIDs or hashes for file names
2. **Content-Type** - Always set correct MIME type
3. **Image optimization** - Convert to WebP, compress
4. **Lazy thumbnails** - Generate on-demand if possible
5. **CDN caching** - Set appropriate cache headers
6. **Access control** - Use presigned URLs for private files
7. **Cleanup** - Remove orphaned files periodically

## Monitoring

### Metrics

| Metric | Description |
|--------|-------------|
| `storage_upload_total` | Total uploads |
| `storage_upload_size_bytes` | Upload sizes |
| `storage_download_total` | Total downloads |
| `storage_errors_total` | Storage errors |

## See Also

- [CDN Integration](../integrations/CLOUDFLARE.md)
- [Product Images](./PIM.md)
- [Performance Guide](../guides/PERFORMANCE.md)
