# Customer Data Platform (CDP)

Централізована платформа для збору та уніфікації даних клієнтів.

## Огляд

| Параметр | Значення |
|----------|----------|
| Data Sources | Web, Mobile, POS, CRM |
| Identity Resolution | Deterministic + Probabilistic |
| Real-time | Yes (streaming) |

### Можливості

- Unified Customer Profile
- Identity Resolution
- Audience Segmentation
- Real-time Event Streaming
- Customer Journey Tracking
- Predictive Analytics

---

## Архітектура

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Web      │  │   Mobile    │  │    POS      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                 ┌──────▼──────┐
                 │  Event Bus  │
                 │ (RabbitMQ)  │
                 └──────┬──────┘
                        │
                 ┌──────▼──────┐
                 │    CDP      │
                 │   Engine    │
                 └──────┬──────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
┌───▼───┐        ┌──────▼──────┐     ┌──────▼──────┐
│Profile│        │   Identity   │     │  Segments   │
│ Store │        │  Resolution  │     │   Engine    │
└───────┘        └─────────────┘     └─────────────┘
```

---

## Data Models

```go
// internal/cdp/models.go
package cdp

import "time"

// UnifiedProfile - єдиний профіль клієнта
type UnifiedProfile struct {
    ID                string                 `json:"id" gorm:"primaryKey"`
    Identities        []Identity             `json:"identities" gorm:"foreignKey:ProfileID"`
    Email             string                 `json:"email"`
    Phone             string                 `json:"phone"`
    FirstName         string                 `json:"first_name"`
    LastName          string                 `json:"last_name"`
    Gender            string                 `json:"gender"`
    BirthDate         *time.Time             `json:"birth_date"`
    Attributes        map[string]interface{} `json:"attributes" gorm:"serializer:json"`
    Segments          []string               `json:"segments" gorm:"serializer:json"`
    Tags              []string               `json:"tags" gorm:"serializer:json"`

    // Computed fields
    LifetimeValue     float64   `json:"lifetime_value"`
    TotalOrders       int       `json:"total_orders"`
    AverageOrderValue float64   `json:"average_order_value"`
    FirstOrderDate    time.Time `json:"first_order_date"`
    LastOrderDate     time.Time `json:"last_order_date"`
    LastActivityDate  time.Time `json:"last_activity_date"`

    // RFM Scores
    RecencyScore      int `json:"recency_score"`
    FrequencyScore    int `json:"frequency_score"`
    MonetaryScore     int `json:"monetary_score"`
    RFMSegment        string `json:"rfm_segment"`

    // Predictive
    ChurnProbability  float64 `json:"churn_probability"`
    NextPurchaseDate  *time.Time `json:"next_purchase_date"`
    PredictedLTV      float64 `json:"predicted_ltv"`

    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

// Identity - різні ідентифікатори клієнта
type Identity struct {
    ID         string    `json:"id" gorm:"primaryKey"`
    ProfileID  string    `json:"profile_id"`
    Type       string    `json:"type"` // email, phone, device_id, customer_id
    Value      string    `json:"value"`
    Verified   bool      `json:"verified"`
    Source     string    `json:"source"` // web, mobile, pos
    CreatedAt  time.Time `json:"created_at"`
}

// CustomerEvent - подія клієнта
type CustomerEvent struct {
    ID         string                 `json:"id" gorm:"primaryKey"`
    ProfileID  string                 `json:"profile_id"`
    Type       string                 `json:"type"` // page_view, product_view, add_to_cart, purchase
    Name       string                 `json:"name"`
    Properties map[string]interface{} `json:"properties" gorm:"serializer:json"`
    Context    EventContext           `json:"context" gorm:"embedded"`
    Timestamp  time.Time              `json:"timestamp"`
}

type EventContext struct {
    SessionID   string `json:"session_id"`
    DeviceID    string `json:"device_id"`
    IPAddress   string `json:"ip_address"`
    UserAgent   string `json:"user_agent"`
    Referrer    string `json:"referrer"`
    UTMSource   string `json:"utm_source"`
    UTMMedium   string `json:"utm_medium"`
    UTMCampaign string `json:"utm_campaign"`
}

// Segment - сегмент аудиторії
type Segment struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    Name        string          `json:"name"`
    Description string          `json:"description"`
    Type        SegmentType     `json:"type"` // static, dynamic, predictive
    Rules       []SegmentRule   `json:"rules" gorm:"foreignKey:SegmentID"`
    Size        int             `json:"size"`
    CreatedAt   time.Time       `json:"created_at"`
    UpdatedAt   time.Time       `json:"updated_at"`
}

type SegmentType string

const (
    SegmentStatic     SegmentType = "static"
    SegmentDynamic    SegmentType = "dynamic"
    SegmentPredictive SegmentType = "predictive"
)

type SegmentRule struct {
    ID         string `json:"id" gorm:"primaryKey"`
    SegmentID  string `json:"segment_id"`
    Field      string `json:"field"` // profile.ltv, behavior.last_purchase_days
    Operator   string `json:"operator"` // eq, gt, lt, in, contains
    Value      string `json:"value"`
    Connector  string `json:"connector"` // AND, OR
}
```

---

## Identity Resolution

```go
// internal/cdp/identity.go
package cdp

import (
    "context"
    "strings"
)

type IdentityResolver struct {
    repo       ProfileRepository
    graphDB    GraphDatabase
}

// Resolve знаходить або створює unified profile
func (r *IdentityResolver) Resolve(ctx context.Context, identities []Identity) (*UnifiedProfile, error) {
    // 1. Шукаємо існуючі profiles за identities
    profiles := make([]*UnifiedProfile, 0)
    for _, id := range identities {
        profile, err := r.repo.FindByIdentity(ctx, id.Type, id.Value)
        if err == nil && profile != nil {
            profiles = append(profiles, profile)
        }
    }

    // 2. Немає співпадінь - створюємо новий profile
    if len(profiles) == 0 {
        return r.createNewProfile(ctx, identities)
    }

    // 3. Один profile - додаємо нові identities
    if len(profiles) == 1 {
        return r.addIdentitiesToProfile(ctx, profiles[0], identities)
    }

    // 4. Кілька profiles - мержимо
    return r.mergeProfiles(ctx, profiles, identities)
}

func (r *IdentityResolver) createNewProfile(ctx context.Context, identities []Identity) (*UnifiedProfile, error) {
    profile := &UnifiedProfile{
        ID:         generateID("prf"),
        Identities: identities,
        CreatedAt:  time.Now(),
        UpdatedAt:  time.Now(),
    }

    // Extract email/phone
    for _, id := range identities {
        switch id.Type {
        case "email":
            profile.Email = id.Value
        case "phone":
            profile.Phone = id.Value
        }
    }

    if err := r.repo.Create(ctx, profile); err != nil {
        return nil, err
    }

    return profile, nil
}

func (r *IdentityResolver) mergeProfiles(ctx context.Context, profiles []*UnifiedProfile, newIdentities []Identity) (*UnifiedProfile, error) {
    // Вибираємо головний profile (найстаріший або з найбільшою активністю)
    primary := r.selectPrimaryProfile(profiles)

    // Мержимо дані
    for _, p := range profiles {
        if p.ID == primary.ID {
            continue
        }

        // Переносимо identities
        for _, id := range p.Identities {
            id.ProfileID = primary.ID
            primary.Identities = append(primary.Identities, id)
        }

        // Мержимо атрибути
        for k, v := range p.Attributes {
            if _, exists := primary.Attributes[k]; !exists {
                primary.Attributes[k] = v
            }
        }

        // Оновлюємо метрики
        primary.LifetimeValue += p.LifetimeValue
        primary.TotalOrders += p.TotalOrders

        // Видаляємо дублікат
        r.repo.Delete(ctx, p.ID)
    }

    // Додаємо нові identities
    for _, id := range newIdentities {
        id.ProfileID = primary.ID
        primary.Identities = append(primary.Identities, id)
    }

    primary.UpdatedAt = time.Now()
    if err := r.repo.Update(ctx, primary); err != nil {
        return nil, err
    }

    return primary, nil
}

func (r *IdentityResolver) selectPrimaryProfile(profiles []*UnifiedProfile) *UnifiedProfile {
    var primary *UnifiedProfile
    for _, p := range profiles {
        if primary == nil || p.LifetimeValue > primary.LifetimeValue {
            primary = p
        }
    }
    return primary
}
```

---

## Event Processing

```go
// internal/cdp/events.go
package cdp

import (
    "context"
    "encoding/json"
)

type EventProcessor struct {
    resolver   *IdentityResolver
    repo       EventRepository
    segmenter  *Segmenter
    enricher   *EventEnricher
}

// Process обробляє вхідну подію
func (p *EventProcessor) Process(ctx context.Context, event *CustomerEvent) error {
    // 1. Resolve identity
    identities := p.extractIdentities(event)
    profile, err := p.resolver.Resolve(ctx, identities)
    if err != nil {
        return err
    }

    event.ProfileID = profile.ID

    // 2. Enrich event
    p.enricher.Enrich(ctx, event)

    // 3. Save event
    if err := p.repo.Create(ctx, event); err != nil {
        return err
    }

    // 4. Update profile metrics
    if err := p.updateProfileMetrics(ctx, profile, event); err != nil {
        return err
    }

    // 5. Re-evaluate segments
    if err := p.segmenter.EvaluateProfile(ctx, profile); err != nil {
        return err
    }

    return nil
}

func (p *EventProcessor) extractIdentities(event *CustomerEvent) []Identity {
    var identities []Identity

    if email, ok := event.Properties["email"].(string); ok && email != "" {
        identities = append(identities, Identity{Type: "email", Value: email})
    }

    if phone, ok := event.Properties["phone"].(string); ok && phone != "" {
        identities = append(identities, Identity{Type: "phone", Value: phone})
    }

    if event.Context.DeviceID != "" {
        identities = append(identities, Identity{Type: "device_id", Value: event.Context.DeviceID})
    }

    return identities
}

func (p *EventProcessor) updateProfileMetrics(ctx context.Context, profile *UnifiedProfile, event *CustomerEvent) error {
    profile.LastActivityDate = event.Timestamp

    switch event.Type {
    case "purchase":
        amount := event.Properties["amount"].(float64)
        profile.LifetimeValue += amount
        profile.TotalOrders++
        profile.LastOrderDate = event.Timestamp
        if profile.FirstOrderDate.IsZero() {
            profile.FirstOrderDate = event.Timestamp
        }
        profile.AverageOrderValue = profile.LifetimeValue / float64(profile.TotalOrders)
    }

    return p.repo.UpdateProfile(ctx, profile)
}
```

---

## Segmentation

```go
// internal/cdp/segmentation.go
package cdp

import (
    "context"
    "strconv"
    "time"
)

type Segmenter struct {
    segmentRepo SegmentRepository
    profileRepo ProfileRepository
}

// EvaluateProfile оцінює профіль для всіх сегментів
func (s *Segmenter) EvaluateProfile(ctx context.Context, profile *UnifiedProfile) error {
    segments, err := s.segmentRepo.FindDynamic(ctx)
    if err != nil {
        return err
    }

    newSegments := make([]string, 0)

    for _, segment := range segments {
        if s.matchesSegment(profile, &segment) {
            newSegments = append(newSegments, segment.ID)
        }
    }

    profile.Segments = newSegments
    return s.profileRepo.Update(ctx, profile)
}

func (s *Segmenter) matchesSegment(profile *UnifiedProfile, segment *Segment) bool {
    for _, rule := range segment.Rules {
        if !s.evaluateRule(profile, &rule) {
            if rule.Connector == "AND" {
                return false
            }
        } else {
            if rule.Connector == "OR" {
                return true
            }
        }
    }
    return true
}

func (s *Segmenter) evaluateRule(profile *UnifiedProfile, rule *SegmentRule) bool {
    value := s.getFieldValue(profile, rule.Field)

    switch rule.Operator {
    case "eq":
        return value == rule.Value
    case "neq":
        return value != rule.Value
    case "gt":
        return s.compareNumeric(value, rule.Value) > 0
    case "lt":
        return s.compareNumeric(value, rule.Value) < 0
    case "gte":
        return s.compareNumeric(value, rule.Value) >= 0
    case "lte":
        return s.compareNumeric(value, rule.Value) <= 0
    case "contains":
        return strings.Contains(value, rule.Value)
    case "in":
        values := strings.Split(rule.Value, ",")
        for _, v := range values {
            if value == strings.TrimSpace(v) {
                return true
            }
        }
        return false
    }
    return false
}

func (s *Segmenter) getFieldValue(profile *UnifiedProfile, field string) string {
    parts := strings.Split(field, ".")
    if len(parts) < 2 {
        return ""
    }

    switch parts[0] {
    case "profile":
        switch parts[1] {
        case "ltv":
            return strconv.FormatFloat(profile.LifetimeValue, 'f', 2, 64)
        case "total_orders":
            return strconv.Itoa(profile.TotalOrders)
        case "rfm_segment":
            return profile.RFMSegment
        case "churn_probability":
            return strconv.FormatFloat(profile.ChurnProbability, 'f', 2, 64)
        }
    case "behavior":
        switch parts[1] {
        case "days_since_last_order":
            days := int(time.Since(profile.LastOrderDate).Hours() / 24)
            return strconv.Itoa(days)
        case "days_since_last_activity":
            days := int(time.Since(profile.LastActivityDate).Hours() / 24)
            return strconv.Itoa(days)
        }
    case "attributes":
        if val, ok := profile.Attributes[parts[1]]; ok {
            return fmt.Sprintf("%v", val)
        }
    }

    return ""
}

// RefreshSegment перераховує всіх членів сегменту
func (s *Segmenter) RefreshSegment(ctx context.Context, segmentID string) error {
    segment, err := s.segmentRepo.FindByID(ctx, segmentID)
    if err != nil {
        return err
    }

    // Build query from rules
    query := s.buildQuery(segment.Rules)

    // Get matching profiles
    profiles, err := s.profileRepo.FindByQuery(ctx, query)
    if err != nil {
        return err
    }

    // Update segment size
    segment.Size = len(profiles)
    segment.UpdatedAt = time.Now()

    return s.segmentRepo.Update(ctx, segment)
}
```

---

## API

### Track Event

```http
POST /api/v1/cdp/track
Content-Type: application/json

{
    "type": "product_view",
    "name": "Product Viewed",
    "properties": {
        "product_id": "prod_123",
        "product_name": "iPhone 15",
        "category": "smartphones",
        "price": 4999900
    },
    "context": {
        "session_id": "sess_abc",
        "device_id": "dev_xyz",
        "user_agent": "Mozilla/5.0..."
    }
}
```

### Get Profile

```http
GET /api/v1/cdp/profiles/{id}
Authorization: Bearer <token>
```

**Response:**

```json
{
    "id": "prf_123",
    "email": "user@example.com",
    "phone": "+380501234567",
    "first_name": "Іван",
    "last_name": "Петренко",
    "lifetime_value": 150000,
    "total_orders": 5,
    "average_order_value": 30000,
    "rfm_segment": "Champions",
    "segments": ["high_value", "active_buyers"],
    "churn_probability": 0.15
}
```

### List Segments

```http
GET /api/admin/cdp/segments
```

### Create Segment

```http
POST /api/admin/cdp/segments
Content-Type: application/json

{
    "name": "High Value Customers",
    "type": "dynamic",
    "rules": [
        {
            "field": "profile.ltv",
            "operator": "gt",
            "value": "100000",
            "connector": "AND"
        },
        {
            "field": "behavior.days_since_last_order",
            "operator": "lt",
            "value": "90"
        }
    ]
}
```

---

## JavaScript SDK

```javascript
// CDP tracking SDK
class CDPClient {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.getOrCreateSessionId();
  }

  track(eventType, eventName, properties = {}) {
    const event = {
      type: eventType,
      name: eventName,
      properties,
      context: {
        session_id: this.sessionId,
        device_id: this.deviceId,
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        url: window.location.href,
        ...this.getUTMParams(),
      },
      timestamp: new Date().toISOString(),
    };

    return fetch(`${this.endpoint}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(event),
    });
  }

  identify(traits) {
    return this.track('identify', 'User Identified', traits);
  }

  page(name, properties = {}) {
    return this.track('page_view', name, {
      ...properties,
      title: document.title,
      path: window.location.pathname,
    });
  }

  productViewed(product) {
    return this.track('product_view', 'Product Viewed', product);
  }

  addedToCart(product, quantity) {
    return this.track('add_to_cart', 'Added to Cart', { ...product, quantity });
  }

  purchased(order) {
    return this.track('purchase', 'Order Completed', order);
  }
}

// Usage
const cdp = new CDPClient({
  endpoint: 'https://api.yourstore.com/api/v1/cdp',
  apiKey: 'your_api_key',
});

cdp.page('Home Page');
cdp.productViewed({ product_id: 'prod_123', name: 'iPhone', price: 4999900 });
```

---

## Predefined Segments

| Segment | Rules |
|---------|-------|
| Champions | RFM 5-5-5, 5-5-4, 5-4-5 |
| Loyal Customers | Frequency > 3, Recency < 30 days |
| At Risk | Was active, Recency > 60 days |
| Lost | Recency > 180 days |
| New Customers | First order < 30 days |
| High Value | LTV > 100000 |
| Cart Abandoners | Cart created, no purchase in 7 days |
