# Visual Search

Пошук товарів за зображеннями з використанням AI.

## Огляд

| Параметр | Значення |
|----------|----------|
| Vector DB | Qdrant |
| Model | CLIP (OpenAI) |
| Dimensions | 512 |
| Similarity | Cosine |

### Можливості

- Пошук схожих товарів за фото
- Завантаження зображення з камери/галереї
- Reverse image search
- Similar products recommendation

---

## Архітектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Core API   │────▶│   Qdrant    │
│  (Upload)   │     │  (Encode)   │     │  (Search)   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                   ┌──────▼──────┐
                   │ CLIP Model  │
                   │ (Embedding) │
                   └─────────────┘
```

### Flow

1. Користувач завантажує зображення
2. CLIP model генерує embedding (512-dim vector)
3. Qdrant шукає найближчі вектори
4. Повертаються схожі товари

---

## Конфігурація

### Environment Variables

```env
# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=your_api_key
QDRANT_COLLECTION=products

# CLIP Model
CLIP_MODEL_PATH=/models/clip-vit-base-patch32
CLIP_DEVICE=cuda  # або cpu
```

### Qdrant Collection

```go
// internal/visualsearch/qdrant.go
type QdrantConfig struct {
    Host       string `env:"QDRANT_HOST" envDefault:"localhost"`
    Port       int    `env:"QDRANT_PORT" envDefault:"6333"`
    APIKey     string `env:"QDRANT_API_KEY"`
    Collection string `env:"QDRANT_COLLECTION" envDefault:"products"`
}

// Створення collection
func (c *Client) CreateCollection(ctx context.Context) error {
    return c.client.CreateCollection(ctx, &qdrant.CreateCollection{
        CollectionName: c.collection,
        VectorsConfig: &qdrant.VectorsConfig{
            Size:     512,
            Distance: qdrant.Distance_Cosine,
        },
    })
}
```

---

## Імплементація

### Visual Search Service

```go
// internal/visualsearch/service.go
package visualsearch

import (
    "context"
    "io"
)

type Service struct {
    qdrant    *QdrantClient
    encoder   *CLIPEncoder
    productRepo ProductRepository
}

type SearchResult struct {
    ProductID  string  `json:"product_id"`
    Score      float32 `json:"score"`
    Product    *Product `json:"product,omitempty"`
}

// SearchByImage шукає товари за зображенням
func (s *Service) SearchByImage(ctx context.Context, image io.Reader, limit int) ([]SearchResult, error) {
    // 1. Encode image to vector
    vector, err := s.encoder.Encode(ctx, image)
    if err != nil {
        return nil, fmt.Errorf("encode image: %w", err)
    }

    // 2. Search in Qdrant
    points, err := s.qdrant.Search(ctx, vector, limit)
    if err != nil {
        return nil, fmt.Errorf("search qdrant: %w", err)
    }

    // 3. Fetch products
    results := make([]SearchResult, len(points))
    for i, point := range points {
        productID := point.Payload["product_id"].(string)
        product, _ := s.productRepo.FindByID(ctx, productID)

        results[i] = SearchResult{
            ProductID: productID,
            Score:     point.Score,
            Product:   product,
        }
    }

    return results, nil
}

// SearchSimilar шукає схожі товари
func (s *Service) SearchSimilar(ctx context.Context, productID string, limit int) ([]SearchResult, error) {
    // Get product vector from Qdrant
    point, err := s.qdrant.Get(ctx, productID)
    if err != nil {
        return nil, err
    }

    // Search similar
    return s.qdrant.SearchByVector(ctx, point.Vector, limit, []string{productID})
}

// IndexProduct індексує товар
func (s *Service) IndexProduct(ctx context.Context, product *Product) error {
    // Encode main image
    vector, err := s.encoder.EncodeURL(ctx, product.MainImage)
    if err != nil {
        return err
    }

    // Upsert to Qdrant
    return s.qdrant.Upsert(ctx, &qdrant.PointStruct{
        Id: product.ID,
        Vector: vector,
        Payload: map[string]interface{}{
            "product_id":  product.ID,
            "name":        product.Name,
            "category_id": product.CategoryID,
            "price":       product.Price,
        },
    })
}

// ReindexAll переіндексовує всі товари
func (s *Service) ReindexAll(ctx context.Context) error {
    // Batch process all products
    offset := 0
    limit := 100

    for {
        products, err := s.productRepo.FindAll(ctx, offset, limit)
        if err != nil {
            return err
        }

        if len(products) == 0 {
            break
        }

        for _, product := range products {
            if err := s.IndexProduct(ctx, &product); err != nil {
                log.Printf("Failed to index product %s: %v", product.ID, err)
            }
        }

        offset += limit
    }

    return nil
}
```

### CLIP Encoder

```go
// internal/visualsearch/clip.go
package visualsearch

import (
    "context"
    "io"
    "net/http"
)

type CLIPEncoder struct {
    modelPath string
    device    string
    // Python bridge або ONNX runtime
}

// Encode генерує embedding для зображення
func (e *CLIPEncoder) Encode(ctx context.Context, image io.Reader) ([]float32, error) {
    // Варіант 1: Виклик Python service через HTTP
    // Варіант 2: ONNX runtime в Go
    // Варіант 3: TensorFlow Serving

    // Приклад з HTTP service
    req, err := http.NewRequestWithContext(ctx, "POST", "http://clip-service:8000/encode", image)
    if err != nil {
        return nil, err
    }
    req.Header.Set("Content-Type", "image/jpeg")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Vector []float32 `json:"vector"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    return result.Vector, nil
}

// EncodeURL завантажує та кодує зображення за URL
func (e *CLIPEncoder) EncodeURL(ctx context.Context, url string) ([]float32, error) {
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    return e.Encode(ctx, resp.Body)
}
```

### Qdrant Client

```go
// internal/visualsearch/qdrant.go
package visualsearch

import (
    "context"

    "github.com/qdrant/go-client/qdrant"
)

type QdrantClient struct {
    client     *qdrant.Client
    collection string
}

func NewQdrantClient(cfg *QdrantConfig) (*QdrantClient, error) {
    client, err := qdrant.NewClient(&qdrant.Config{
        Host:   cfg.Host,
        Port:   cfg.Port,
        APIKey: cfg.APIKey,
    })
    if err != nil {
        return nil, err
    }

    return &QdrantClient{
        client:     client,
        collection: cfg.Collection,
    }, nil
}

func (c *QdrantClient) Search(ctx context.Context, vector []float32, limit int) ([]*qdrant.ScoredPoint, error) {
    return c.client.Search(ctx, &qdrant.SearchPoints{
        CollectionName: c.collection,
        Vector:         vector,
        Limit:          uint64(limit),
        WithPayload:    &qdrant.WithPayloadSelector{Enable: true},
    })
}

func (c *QdrantClient) Upsert(ctx context.Context, point *qdrant.PointStruct) error {
    _, err := c.client.Upsert(ctx, &qdrant.UpsertPoints{
        CollectionName: c.collection,
        Points:         []*qdrant.PointStruct{point},
    })
    return err
}

func (c *QdrantClient) Delete(ctx context.Context, id string) error {
    _, err := c.client.Delete(ctx, &qdrant.DeletePoints{
        CollectionName: c.collection,
        Points: &qdrant.PointsSelector{
            Points: &qdrant.PointsSelector_Points{
                Points: &qdrant.PointsIdsList{
                    Ids: []*qdrant.PointId{{Id: &qdrant.PointId_Uuid{Uuid: id}}},
                },
            },
        },
    })
    return err
}
```

---

## API Endpoints

### Search by Image

```http
POST /api/v1/visual-search
Content-Type: multipart/form-data

file: <image file>
limit: 20
```

**Response:**

```json
{
  "results": [
    {
      "product_id": "prod_123",
      "score": 0.95,
      "product": {
        "id": "prod_123",
        "name": "iPhone 15 Pro",
        "price": 4999900,
        "image": "https://cdn.example.com/iphone.jpg"
      }
    }
  ]
}
```

### Similar Products

```http
GET /api/v1/products/{id}/similar?limit=10
```

**Response:**

```json
{
  "results": [
    {
      "product_id": "prod_456",
      "score": 0.89,
      "product": { ... }
    }
  ]
}
```

---

## Frontend Integration

### Upload Component

```tsx
// components/visual-search/ImageSearch.tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface ImageSearchProps {
  onResults: (results: SearchResult[]) => void;
}

export function ImageSearch({ onResults }: ImageSearchProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Show preview
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('limit', '20');

      const response = await fetch('/api/v1/visual-search', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      onResults(data.results);
    } catch (error) {
      console.error('Visual search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [onResults]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
        `}
      >
        <input {...getInputProps()} />
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-48 mx-auto" />
        ) : (
          <>
            <CameraIcon className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-2">
              {isDragActive
                ? 'Відпустіть зображення...'
                : 'Перетягніть зображення або натисніть для вибору'}
            </p>
          </>
        )}
      </div>

      {loading && (
        <div className="flex justify-center">
          <Spinner />
          <span className="ml-2">Шукаємо схожі товари...</span>
        </div>
      )}
    </div>
  );
}
```

### Camera Capture

```tsx
// components/visual-search/CameraCapture.tsx
import { useRef, useState } from 'react';

export function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        onCapture(file);
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-lg"
      />

      {!streaming ? (
        <button onClick={startCamera} className="btn btn-primary w-full">
          Увімкнути камеру
        </button>
      ) : (
        <button onClick={capturePhoto} className="btn btn-primary w-full">
          Зробити фото
        </button>
      )}
    </div>
  );
}
```

---

## Python CLIP Service

```python
# clip-service/main.py
from fastapi import FastAPI, File, UploadFile
from PIL import Image
import torch
import clip
import io
import numpy as np

app = FastAPI()

# Load CLIP model
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

@app.post("/encode")
async def encode_image(file: UploadFile = File(...)):
    # Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    # Preprocess and encode
    image_input = preprocess(image).unsqueeze(0).to(device)

    with torch.no_grad():
        image_features = model.encode_image(image_input)
        image_features /= image_features.norm(dim=-1, keepdim=True)

    vector = image_features.cpu().numpy()[0].tolist()

    return {"vector": vector}

@app.post("/encode-text")
async def encode_text(text: str):
    text_input = clip.tokenize([text]).to(device)

    with torch.no_grad():
        text_features = model.encode_text(text_input)
        text_features /= text_features.norm(dim=-1, keepdim=True)

    vector = text_features.cpu().numpy()[0].tolist()

    return {"vector": vector}
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install fastapi uvicorn torch torchvision clip-by-openai pillow

COPY main.py .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Моніторинг

### Метрики

```go
var (
    searchRequests = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "visual_search_requests_total",
            Help: "Total visual search requests",
        },
        []string{"status"},
    )

    searchLatency = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Name:    "visual_search_latency_seconds",
            Help:    "Visual search latency",
            Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5},
        },
    )

    indexedProducts = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "visual_search_indexed_products",
            Help: "Number of indexed products",
        },
    )
)
```

---

## Тестування

```go
func TestSearchByImage(t *testing.T) {
    // Mock CLIP encoder
    encoder := &MockCLIPEncoder{
        Vector: make([]float32, 512),
    }

    // Mock Qdrant
    qdrant := &MockQdrantClient{
        Results: []*qdrant.ScoredPoint{
            {Id: "prod_1", Score: 0.95},
            {Id: "prod_2", Score: 0.87},
        },
    }

    service := NewService(qdrant, encoder, nil)

    results, err := service.SearchByImage(context.Background(), bytes.NewReader(testImage), 10)

    require.NoError(t, err)
    assert.Len(t, results, 2)
    assert.Equal(t, float32(0.95), results[0].Score)
}
```
