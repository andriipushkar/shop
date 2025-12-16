# Data Export

Система експорту даних у різних форматах для звітності та інтеграцій.

## Overview

Модуль export забезпечує:
- Експорт у CSV, Excel, JSON, XML
- Асинхронний експорт великих даних
- Шаблони експорту
- Планові експорти (scheduled)
- Доставка файлів (email, S3, FTP)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      EXPORT SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │   Export     │                    │   Data Sources        │  │
│  │   Request    │                    │                       │  │
│  └──────┬───────┘                    │  - Products           │  │
│         │                            │  - Orders             │  │
│         ▼                            │  - Customers          │  │
│  ┌──────────────┐                    │  - Analytics          │  │
│  │  Export Job  │◄───────────────────│  - Inventory          │  │
│  │  (async)     │                    │                       │  │
│  └──────┬───────┘                    └───────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │   Format     │────▶│   Delivery   │                         │
│  │   Generator  │     │   Service    │                         │
│  │              │     │              │                         │
│  │  - CSV       │     │  - Download  │                         │
│  │  - Excel     │     │  - Email     │                         │
│  │  - JSON      │     │  - S3        │                         │
│  │  - XML       │     │  - FTP       │                         │
│  └──────────────┘     └──────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| CSV | .csv | Comma-separated values |
| Excel | .xlsx | Microsoft Excel |
| JSON | .json | JSON array |
| XML | .xml | XML document |
| YML | .yml | Yandex Market format |

## Export Types

### Products Export

```go
type ProductExport struct {
    ID          string  `csv:"id" json:"id" xlsx:"ID"`
    SKU         string  `csv:"sku" json:"sku" xlsx:"SKU"`
    Name        string  `csv:"name" json:"name" xlsx:"Назва"`
    Description string  `csv:"description" json:"description" xlsx:"Опис"`
    Price       float64 `csv:"price" json:"price" xlsx:"Ціна"`
    Stock       int     `csv:"stock" json:"stock" xlsx:"Залишок"`
    Category    string  `csv:"category" json:"category" xlsx:"Категорія"`
    Brand       string  `csv:"brand" json:"brand" xlsx:"Бренд"`
    ImageURL    string  `csv:"image_url" json:"image_url" xlsx:"Фото"`
    IsActive    bool    `csv:"is_active" json:"is_active" xlsx:"Активний"`
}
```

### Orders Export

```go
type OrderExport struct {
    ID            string    `csv:"id" xlsx:"№ Замовлення"`
    CreatedAt     time.Time `csv:"created_at" xlsx:"Дата"`
    CustomerName  string    `csv:"customer_name" xlsx:"Клієнт"`
    CustomerPhone string    `csv:"customer_phone" xlsx:"Телефон"`
    Status        string    `csv:"status" xlsx:"Статус"`
    Total         float64   `csv:"total" xlsx:"Сума"`
    Items         string    `csv:"items" xlsx:"Товари"`
    DeliveryMethod string   `csv:"delivery_method" xlsx:"Доставка"`
    TrackingNumber string   `csv:"tracking_number" xlsx:"ТТН"`
}
```

### Customers Export

```go
type CustomerExport struct {
    ID          string    `csv:"id" xlsx:"ID"`
    Email       string    `csv:"email" xlsx:"Email"`
    Phone       string    `csv:"phone" xlsx:"Телефон"`
    FirstName   string    `csv:"first_name" xlsx:"Ім'я"`
    LastName    string    `csv:"last_name" xlsx:"Прізвище"`
    OrdersCount int       `csv:"orders_count" xlsx:"Замовлень"`
    TotalSpent  float64   `csv:"total_spent" xlsx:"Витрачено"`
    CreatedAt   time.Time `csv:"created_at" xlsx:"Дата реєстрації"`
}
```

## Usage

### Create Export Job

```go
import "shop/services/core/internal/export"

job, err := export.CreateJob(ctx, &export.JobRequest{
    Type:   "products",
    Format: "xlsx",
    Filters: map[string]interface{}{
        "category_id": "cat-123",
        "is_active":   true,
    },
    Columns: []string{"sku", "name", "price", "stock"},
    Delivery: &export.Delivery{
        Type:  "email",
        Email: "manager@shop.ua",
    },
})

fmt.Printf("Export job created: %s\n", job.ID)
```

### Check Job Status

```go
job, err := export.GetJob(ctx, jobID)

fmt.Printf("Status: %s\n", job.Status)  // pending, processing, completed, failed
fmt.Printf("Progress: %d%%\n", job.Progress)
fmt.Printf("Records: %d\n", job.RecordsCount)
```

### Download Export

```go
// Get download URL
url, err := export.GetDownloadURL(ctx, jobID)

// Stream download
reader, err := export.Download(ctx, jobID)
defer reader.Close()
```

### Sync Export (small datasets)

```go
// Direct export without async job
data, err := export.ExportProducts(ctx, &export.ExportParams{
    Format: "csv",
    Filters: map[string]interface{}{
        "is_active": true,
    },
})

// Write to response
w.Header().Set("Content-Type", "text/csv")
w.Header().Set("Content-Disposition", "attachment; filename=products.csv")
w.Write(data)
```

## API Endpoints

```
POST   /api/v1/export                # Create export job
GET    /api/v1/export/:id            # Get job status
GET    /api/v1/export/:id/download   # Download file
DELETE /api/v1/export/:id            # Cancel/delete job
GET    /api/v1/export/templates      # List templates
POST   /api/v1/export/templates      # Create template
```

### Create Export Request

```json
POST /api/v1/export
{
  "type": "orders",
  "format": "xlsx",
  "filters": {
    "status": "completed",
    "date_from": "2024-01-01",
    "date_to": "2024-01-31"
  },
  "columns": ["id", "created_at", "customer_name", "total", "status"],
  "delivery": {
    "type": "email",
    "email": "manager@shop.ua"
  }
}
```

### Response

```json
{
  "id": "export_abc123",
  "status": "pending",
  "type": "orders",
  "format": "xlsx",
  "created_at": "2024-01-15T10:30:00Z",
  "estimated_records": 1500
}
```

### Job Status Response

```json
{
  "id": "export_abc123",
  "status": "completed",
  "progress": 100,
  "records_count": 1456,
  "file_size": 245678,
  "download_url": "https://cdn.shop.ua/exports/export_abc123.xlsx",
  "expires_at": "2024-01-16T10:30:00Z",
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:32:15Z"
}
```

## Export Templates

```go
type ExportTemplate struct {
    ID        string                 `json:"id"`
    Name      string                 `json:"name"`
    Type      string                 `json:"type"`      // products, orders, etc.
    Format    string                 `json:"format"`
    Columns   []string               `json:"columns"`
    Filters   map[string]interface{} `json:"filters"`
    Schedule  *Schedule              `json:"schedule,omitempty"`
    Delivery  *Delivery              `json:"delivery,omitempty"`
    CreatedBy string                 `json:"created_by"`
}

type Schedule struct {
    Cron     string `json:"cron"`      // "0 9 * * 1" (every Monday at 9am)
    Timezone string `json:"timezone"`  // "Europe/Kyiv"
}
```

### Scheduled Export

```json
POST /api/v1/export/templates
{
  "name": "Weekly Orders Report",
  "type": "orders",
  "format": "xlsx",
  "columns": ["id", "created_at", "total", "status"],
  "filters": {
    "status": "completed"
  },
  "schedule": {
    "cron": "0 9 * * 1",
    "timezone": "Europe/Kyiv"
  },
  "delivery": {
    "type": "email",
    "email": "reports@shop.ua"
  }
}
```

## YML Feed (Yandex Market)

```go
feed, err := export.GenerateYMLFeed(ctx, &export.YMLParams{
    ShopName:    "My Shop",
    CompanyName: "ТОВ Мій Магазин",
    URL:         "https://shop.ua",
    Categories:  categories,
    Products:    products,
})

// Output XML
w.Header().Set("Content-Type", "application/xml")
w.Write(feed)
```

## Configuration

```bash
# Export settings
EXPORT_MAX_RECORDS=100000
EXPORT_CHUNK_SIZE=1000
EXPORT_FILE_TTL=24h
EXPORT_STORAGE_PATH=exports/

# Delivery
EXPORT_EMAIL_FROM=exports@shop.ua
EXPORT_S3_BUCKET=shop-exports
EXPORT_FTP_HOST=ftp.example.com
```

## Best Practices

1. **Async for large exports** - Use jobs for >1000 records
2. **Chunked processing** - Process in batches
3. **Compression** - Compress large files
4. **TTL** - Auto-delete old exports
5. **Rate limiting** - Limit concurrent exports
6. **Progress tracking** - Show progress for large exports
7. **Error handling** - Retry failed exports

## See Also

- [Import](./PIM.md#import)
- [Analytics](./ANALYTICS.md)
- [Storage](./STORAGE.md)
