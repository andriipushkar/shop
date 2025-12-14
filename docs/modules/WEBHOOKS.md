# Webhooks Module

Система вебхуків для інтеграції з зовнішніми сервісами.

## Огляд

| Властивість | Значення |
|-------------|----------|
| Формат | JSON |
| Автентифікація | HMAC-SHA256 |
| Повторні спроби | Exponential backoff |
| Максимум спроб | 5 |

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      WEBHOOKS MODULE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │  RabbitMQ   │────▶│   Webhook   │────▶│   Dispatcher    │   │
│  │   Events    │     │   Matcher   │     │                 │   │
│  └─────────────┘     └─────────────┘     └────────┬────────┘   │
│                                                    │            │
│                                          ┌────────┴────────┐   │
│                                          │    HTTP Client  │   │
│                                          │                 │   │
│                                          │  • Retry logic  │   │
│                                          │  • Signatures   │   │
│                                          │  • Timeouts     │   │
│                                          └────────┬────────┘   │
│                                                    │            │
│                                                    ▼            │
│                                          ┌─────────────────┐   │
│                                          │ External URLs   │   │
│                                          │ (Subscribers)   │   │
│                                          └─────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Типи подій

### Order Events

| Подія | Опис |
|-------|------|
| `order.created` | Замовлення створено |
| `order.confirmed` | Замовлення підтверджено |
| `order.paid` | Замовлення оплачено |
| `order.shipped` | Замовлення відправлено |
| `order.delivered` | Замовлення доставлено |
| `order.cancelled` | Замовлення скасовано |
| `order.refunded` | Кошти повернуто |

### Product Events

| Подія | Опис |
|-------|------|
| `product.created` | Товар створено |
| `product.updated` | Товар оновлено |
| `product.deleted` | Товар видалено |
| `product.stock.low` | Низький залишок |
| `product.stock.out` | Немає в наявності |

### Customer Events

| Подія | Опис |
|-------|------|
| `customer.created` | Клієнт зареєструвався |
| `customer.updated` | Профіль оновлено |
| `customer.tier.changed` | Змінився рівень лояльності |

### Payment Events

| Подія | Опис |
|-------|------|
| `payment.completed` | Оплата успішна |
| `payment.failed` | Оплата не вдалась |
| `refund.completed` | Повернення завершено |

## Формат запиту

### HTTP Headers

```http
POST /your-webhook-endpoint HTTP/1.1
Content-Type: application/json
X-Webhook-ID: wh_123456789
X-Webhook-Timestamp: 1704096000
X-Webhook-Signature: sha256=abc123...
X-Webhook-Event: order.created
User-Agent: ShopPlatform-Webhook/1.0
```

### Request Body

```json
{
  "id": "evt_123456789",
  "type": "order.created",
  "tenant_id": "tenant_abc",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {
    "order_id": "order_xyz",
    "order_number": "ORD-2024-001",
    "customer": {
      "id": "cust_123",
      "email": "customer@example.com",
      "phone": "+380991234567"
    },
    "items": [
      {
        "product_id": "prod_456",
        "sku": "SKU001",
        "name": "Product Name",
        "quantity": 2,
        "price": 500.00
      }
    ],
    "subtotal": 1000.00,
    "shipping": 50.00,
    "discount": 100.00,
    "total": 950.00,
    "currency": "UAH",
    "status": "pending",
    "shipping_address": {
      "city": "Київ",
      "address": "вул. Хрещатик, 1"
    }
  }
}
```

## Підпис (Signature)

### Генерація підпису

```go
func generateSignature(payload []byte, secret string, timestamp int64) string {
    // Формуємо рядок для підпису
    signedPayload := fmt.Sprintf("%d.%s", timestamp, string(payload))

    // HMAC-SHA256
    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(signedPayload))

    return "sha256=" + hex.EncodeToString(h.Sum(nil))
}
```

### Верифікація підпису (на стороні клієнта)

```go
func verifySignature(payload []byte, signature string, secret string, timestamp int64) bool {
    // Перевірка часу (±5 хвилин)
    now := time.Now().Unix()
    if abs(now-timestamp) > 300 {
        return false // Replay attack protection
    }

    expected := generateSignature(payload, secret, timestamp)
    return hmac.Equal([]byte(signature), []byte(expected))
}
```

### Приклад верифікації (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  // Check timestamp
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  // Verify signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw new Error('Invalid webhook signature');
  }

  return JSON.parse(payload);
}

// Express middleware
app.post('/webhook', (req, res) => {
  try {
    const event = verifyWebhook(
      req.body,
      req.headers['x-webhook-signature'],
      parseInt(req.headers['x-webhook-timestamp']),
      process.env.WEBHOOK_SECRET
    );

    // Process event...
    res.status(200).send('OK');
  } catch (err) {
    res.status(400).send(err.message);
  }
});
```

## Керування підписками

### Модель даних

```go
type WebhookEndpoint struct {
    ID          string    `json:"id"`
    TenantID    string    `json:"tenant_id"`
    URL         string    `json:"url"`
    Secret      string    `json:"-"` // Не повертається в API
    Events      []string  `json:"events"`
    Active      bool      `json:"active"`
    Description string    `json:"description,omitempty"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type WebhookDelivery struct {
    ID           string    `json:"id"`
    EndpointID   string    `json:"endpoint_id"`
    EventID      string    `json:"event_id"`
    EventType    string    `json:"event_type"`
    URL          string    `json:"url"`
    RequestBody  string    `json:"request_body"`
    ResponseCode int       `json:"response_code"`
    ResponseBody string    `json:"response_body,omitempty"`
    Duration     int       `json:"duration_ms"`
    Attempt      int       `json:"attempt"`
    Status       string    `json:"status"` // pending, success, failed
    Error        string    `json:"error,omitempty"`
    CreatedAt    time.Time `json:"created_at"`
}
```

### API Endpoints

#### Create Webhook

```
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["order.created", "order.shipped"],
  "description": "Order notifications"
}
```

Response:
```json
{
  "id": "whk_123456",
  "url": "https://your-server.com/webhook",
  "secret": "whsec_abc123xyz...",
  "events": ["order.created", "order.shipped"],
  "active": true,
  "created_at": "2024-01-15T10:00:00Z"
}
```

#### List Webhooks

```
GET /api/v1/webhooks
```

Response:
```json
{
  "webhooks": [
    {
      "id": "whk_123456",
      "url": "https://your-server.com/webhook",
      "events": ["order.created", "order.shipped"],
      "active": true
    }
  ]
}
```

#### Update Webhook

```
PATCH /api/v1/webhooks/{id}

{
  "events": ["order.*"],
  "active": false
}
```

#### Delete Webhook

```
DELETE /api/v1/webhooks/{id}
```

#### Rotate Secret

```
POST /api/v1/webhooks/{id}/rotate-secret
```

Response:
```json
{
  "secret": "whsec_new_secret..."
}
```

#### Get Delivery Attempts

```
GET /api/v1/webhooks/{id}/deliveries?limit=50
```

Response:
```json
{
  "deliveries": [
    {
      "id": "del_123",
      "event_type": "order.created",
      "status": "success",
      "response_code": 200,
      "duration_ms": 145,
      "attempt": 1,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Retry Delivery

```
POST /api/v1/webhooks/deliveries/{delivery_id}/retry
```

## Retry Logic

### Exponential Backoff

```go
type RetryConfig struct {
    MaxAttempts   int           // 5
    InitialDelay  time.Duration // 1 minute
    MaxDelay      time.Duration // 24 hours
    BackoffFactor float64       // 2.0
}

// Retry schedule:
// Attempt 1: Immediate
// Attempt 2: 1 minute
// Attempt 3: 2 minutes
// Attempt 4: 4 minutes
// Attempt 5: 8 minutes

func calculateDelay(attempt int, config RetryConfig) time.Duration {
    if attempt <= 1 {
        return 0
    }

    delay := float64(config.InitialDelay) * math.Pow(config.BackoffFactor, float64(attempt-2))

    if time.Duration(delay) > config.MaxDelay {
        return config.MaxDelay
    }

    return time.Duration(delay)
}
```

### Success Criteria

HTTP статуси 2xx вважаються успішними. Все інше - помилка.

```go
func isSuccessStatus(code int) bool {
    return code >= 200 && code < 300
}
```

## Dispatcher

### Реалізація

```go
type WebhookDispatcher struct {
    client     *http.Client
    repo       WebhookRepository
    queue      *amqp.Channel
    maxWorkers int
}

func (d *WebhookDispatcher) Dispatch(ctx context.Context, event Event) error {
    // Знаходимо всі підписки для цієї події
    endpoints, err := d.repo.FindByEventType(ctx, event.TenantID, event.Type)
    if err != nil {
        return err
    }

    for _, endpoint := range endpoints {
        if !endpoint.Active {
            continue
        }

        // Створюємо delivery
        delivery := &WebhookDelivery{
            ID:         uuid.New().String(),
            EndpointID: endpoint.ID,
            EventID:    event.ID,
            EventType:  event.Type,
            URL:        endpoint.URL,
            Status:     "pending",
            Attempt:    1,
        }

        // Відправляємо асинхронно
        go d.sendWithRetry(ctx, endpoint, event, delivery)
    }

    return nil
}

func (d *WebhookDispatcher) sendWithRetry(ctx context.Context, endpoint *WebhookEndpoint, event Event, delivery *WebhookDelivery) {
    payload, _ := json.Marshal(event)
    timestamp := time.Now().Unix()
    signature := generateSignature(payload, endpoint.Secret, timestamp)

    for attempt := 1; attempt <= 5; attempt++ {
        delivery.Attempt = attempt

        req, _ := http.NewRequestWithContext(ctx, "POST", endpoint.URL, bytes.NewReader(payload))
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("X-Webhook-ID", delivery.ID)
        req.Header.Set("X-Webhook-Timestamp", strconv.FormatInt(timestamp, 10))
        req.Header.Set("X-Webhook-Signature", signature)
        req.Header.Set("X-Webhook-Event", event.Type)

        start := time.Now()
        resp, err := d.client.Do(req)
        delivery.Duration = int(time.Since(start).Milliseconds())

        if err != nil {
            delivery.Status = "failed"
            delivery.Error = err.Error()
            d.repo.SaveDelivery(ctx, delivery)

            time.Sleep(calculateDelay(attempt+1, DefaultRetryConfig))
            continue
        }

        body, _ := io.ReadAll(resp.Body)
        resp.Body.Close()

        delivery.ResponseCode = resp.StatusCode
        delivery.ResponseBody = string(body)

        if isSuccessStatus(resp.StatusCode) {
            delivery.Status = "success"
            d.repo.SaveDelivery(ctx, delivery)
            return
        }

        delivery.Status = "failed"
        d.repo.SaveDelivery(ctx, delivery)

        if attempt < 5 {
            time.Sleep(calculateDelay(attempt+1, DefaultRetryConfig))
        }
    }

    // Всі спроби вичерпано
    d.notifyFailure(endpoint, delivery)
}
```

## Wildcard Subscriptions

Підтримка wildcard для подій:

```go
// events: ["order.*"] - всі події замовлень
// events: ["*"] - всі події

func matchEvent(pattern, eventType string) bool {
    if pattern == "*" {
        return true
    }

    if strings.HasSuffix(pattern, ".*") {
        prefix := strings.TrimSuffix(pattern, ".*")
        return strings.HasPrefix(eventType, prefix+".")
    }

    return pattern == eventType
}
```

## Testing Webhooks

### Test Endpoint

```
POST /api/v1/webhooks/{id}/test

{
  "event_type": "order.created"
}
```

Відправляє тестову подію з фейковими даними.

### Webhook Debugger (CLI)

```bash
# Запуск локального серверу для тестування
npx localtunnel --port 3000

# Або використати webhook.site
curl https://webhook.site/token
```

## Метрики

| Метрика | Опис |
|---------|------|
| `webhooks_dispatched_total` | Відправлені вебхуки |
| `webhooks_success_total` | Успішні |
| `webhooks_failed_total` | Невдалі |
| `webhooks_retry_total` | Повторні спроби |
| `webhook_latency_seconds` | Час відповіді endpoint |

## Ліміти

| Обмеження | Значення |
|-----------|----------|
| Макс. endpoints на tenant | 20 |
| Макс. events на endpoint | 50 |
| Timeout запиту | 30 секунд |
| Макс. розмір payload | 1 MB |
| Retention deliveries | 30 днів |

## Конфігурація

```bash
# Webhooks
WEBHOOK_TIMEOUT=30s
WEBHOOK_MAX_RETRIES=5
WEBHOOK_RETRY_INITIAL_DELAY=1m
WEBHOOK_RETRY_MAX_DELAY=24h
WEBHOOK_MAX_ENDPOINTS_PER_TENANT=20

# Workers
WEBHOOK_DISPATCHER_WORKERS=10
WEBHOOK_QUEUE_SIZE=1000
```
