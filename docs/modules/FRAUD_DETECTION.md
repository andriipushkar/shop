# Fraud Detection

Система виявлення шахрайства в реальному часі.

## Огляд

| Параметр | Значення |
|----------|----------|
| Engine | Rule-based + ML |
| Latency | < 100ms |
| False Positive Rate | < 2% |

### Типи шахрайства

- Платіжне шахрайство (card fraud)
- Захоплення акаунтів (account takeover)
- Зловживання промокодами
- Fake reviews
- Bot attacks

---

## Архітектура

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request    │────▶│ Fraud Engine │────▶│   Decision   │
│  (Order/     │     │              │     │  (Allow/     │
│   Payment)   │     │  - Rules     │     │   Review/    │
└──────────────┘     │  - ML Model  │     │   Block)     │
                     │  - Velocity  │     └──────────────┘
                     └──────────────┘
                            │
                     ┌──────▼──────┐
                     │   Signals   │
                     │  - Device   │
                     │  - IP       │
                     │  - Behavior │
                     └─────────────┘
```

---

## Конфігурація

```env
# Fraud Detection
FRAUD_ENABLED=true
FRAUD_BLOCK_THRESHOLD=80
FRAUD_REVIEW_THRESHOLD=50
FRAUD_ML_MODEL_PATH=/models/fraud_model.onnx

# Velocity Limits
FRAUD_MAX_ORDERS_PER_HOUR=10
FRAUD_MAX_CARDS_PER_ACCOUNT=5
FRAUD_MAX_ACCOUNTS_PER_DEVICE=3
```

---

## Імплементація

### Fraud Service

```go
// internal/fraud/service.go
package fraud

import (
    "context"
    "time"
)

type Service struct {
    rules       []Rule
    mlModel     *MLModel
    velocity    *VelocityChecker
    deviceRepo  DeviceRepository
    signalRepo  SignalRepository
}

type Decision string

const (
    DecisionAllow  Decision = "allow"
    DecisionReview Decision = "review"
    DecisionBlock  Decision = "block"
)

type CheckResult struct {
    Decision    Decision          `json:"decision"`
    Score       float64           `json:"score"`
    Reasons     []string          `json:"reasons"`
    Signals     map[string]Signal `json:"signals"`
    RequestID   string            `json:"request_id"`
    CheckedAt   time.Time         `json:"checked_at"`
}

type CheckRequest struct {
    Type        string            // order, payment, login
    UserID      string
    SessionID   string
    IPAddress   string
    DeviceID    string
    UserAgent   string
    Amount      int64
    Currency    string
    CardBIN     string
    Email       string
    Phone       string
    ShippingAddress *Address
    BillingAddress  *Address
    Metadata    map[string]interface{}
}

// Check перевіряє транзакцію на шахрайство
func (s *Service) Check(ctx context.Context, req *CheckRequest) (*CheckResult, error) {
    result := &CheckResult{
        Decision:  DecisionAllow,
        RequestID: generateID("frq"),
        CheckedAt: time.Now(),
        Signals:   make(map[string]Signal),
    }

    // 1. Збираємо сигнали
    signals := s.collectSignals(ctx, req)
    result.Signals = signals

    // 2. Перевіряємо правила
    ruleScore, ruleReasons := s.checkRules(ctx, req, signals)
    result.Reasons = append(result.Reasons, ruleReasons...)

    // 3. ML scoring
    mlScore := s.mlModel.Predict(ctx, signals)

    // 4. Velocity checks
    velocityScore, velocityReasons := s.velocity.Check(ctx, req)
    result.Reasons = append(result.Reasons, velocityReasons...)

    // 5. Комбінуємо scores
    result.Score = combineScores(ruleScore, mlScore, velocityScore)

    // 6. Приймаємо рішення
    result.Decision = s.makeDecision(result.Score)

    // 7. Зберігаємо результат
    s.signalRepo.Save(ctx, result)

    // 8. Метрики
    fraudCheckTotal.WithLabelValues(string(result.Decision)).Inc()
    fraudScoreHistogram.Observe(result.Score)

    return result, nil
}

func (s *Service) collectSignals(ctx context.Context, req *CheckRequest) map[string]Signal {
    signals := make(map[string]Signal)

    // Device fingerprint
    device, _ := s.deviceRepo.GetOrCreate(ctx, req.DeviceID)
    signals["device"] = Signal{
        Name:  "device",
        Value: device.RiskScore,
        Data: map[string]interface{}{
            "first_seen":    device.FirstSeen,
            "accounts":      device.AccountCount,
            "orders":        device.OrderCount,
            "fraud_history": device.FraudCount,
        },
    }

    // IP analysis
    ipInfo := s.analyzeIP(ctx, req.IPAddress)
    signals["ip"] = Signal{
        Name:  "ip",
        Value: ipInfo.RiskScore,
        Data: map[string]interface{}{
            "country":     ipInfo.Country,
            "is_proxy":    ipInfo.IsProxy,
            "is_vpn":      ipInfo.IsVPN,
            "is_tor":      ipInfo.IsTor,
            "is_datacenter": ipInfo.IsDatacenter,
        },
    }

    // Email analysis
    emailInfo := s.analyzeEmail(ctx, req.Email)
    signals["email"] = Signal{
        Name:  "email",
        Value: emailInfo.RiskScore,
        Data: map[string]interface{}{
            "domain":      emailInfo.Domain,
            "is_disposable": emailInfo.IsDisposable,
            "age_days":    emailInfo.AgeDays,
        },
    }

    // Behavioral signals
    behavior := s.analyzeBehavior(ctx, req)
    signals["behavior"] = Signal{
        Name:  "behavior",
        Value: behavior.RiskScore,
        Data: map[string]interface{}{
            "session_duration": behavior.SessionDuration,
            "pages_viewed":     behavior.PagesViewed,
            "is_bot_like":      behavior.IsBotLike,
        },
    }

    // Card BIN analysis
    if req.CardBIN != "" {
        binInfo := s.analyzeBIN(ctx, req.CardBIN)
        signals["card"] = Signal{
            Name:  "card",
            Value: binInfo.RiskScore,
            Data: map[string]interface{}{
                "bank":    binInfo.Bank,
                "country": binInfo.Country,
                "type":    binInfo.Type,
            },
        }
    }

    return signals
}

func (s *Service) makeDecision(score float64) Decision {
    if score >= s.cfg.BlockThreshold {
        return DecisionBlock
    }
    if score >= s.cfg.ReviewThreshold {
        return DecisionReview
    }
    return DecisionAllow
}
```

### Rules Engine

```go
// internal/fraud/rules.go
package fraud

type Rule interface {
    Name() string
    Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (score float64, reason string)
}

// High-risk country rule
type HighRiskCountryRule struct {
    countries map[string]bool
}

func (r *HighRiskCountryRule) Name() string {
    return "high_risk_country"
}

func (r *HighRiskCountryRule) Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (float64, string) {
    ipSignal := signals["ip"]
    country := ipSignal.Data["country"].(string)

    if r.countries[country] {
        return 30, fmt.Sprintf("IP from high-risk country: %s", country)
    }
    return 0, ""
}

// Proxy/VPN rule
type ProxyRule struct{}

func (r *ProxyRule) Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (float64, string) {
    ipSignal := signals["ip"]

    if ipSignal.Data["is_tor"].(bool) {
        return 50, "Tor exit node detected"
    }
    if ipSignal.Data["is_proxy"].(bool) {
        return 20, "Proxy detected"
    }
    if ipSignal.Data["is_vpn"].(bool) {
        return 10, "VPN detected"
    }
    return 0, ""
}

// Disposable email rule
type DisposableEmailRule struct{}

func (r *DisposableEmailRule) Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (float64, string) {
    emailSignal := signals["email"]

    if emailSignal.Data["is_disposable"].(bool) {
        return 40, "Disposable email address"
    }
    return 0, ""
}

// Address mismatch rule
type AddressMismatchRule struct{}

func (r *AddressMismatchRule) Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (float64, string) {
    if req.ShippingAddress == nil || req.BillingAddress == nil {
        return 0, ""
    }

    // Different countries
    if req.ShippingAddress.Country != req.BillingAddress.Country {
        return 25, "Shipping and billing countries differ"
    }

    // Different cities
    if req.ShippingAddress.City != req.BillingAddress.City {
        return 10, "Shipping and billing cities differ"
    }

    return 0, ""
}

// New device with high amount
type NewDeviceHighAmountRule struct {
    threshold int64
}

func (r *NewDeviceHighAmountRule) Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (float64, string) {
    deviceSignal := signals["device"]
    firstSeen := deviceSignal.Data["first_seen"].(time.Time)

    // Device less than 24 hours old
    if time.Since(firstSeen) < 24*time.Hour && req.Amount > r.threshold {
        return 35, "New device with high-value order"
    }
    return 0, ""
}

// Card-country mismatch
type CardCountryMismatchRule struct{}

func (r *CardCountryMismatchRule) Check(ctx context.Context, req *CheckRequest, signals map[string]Signal) (float64, string) {
    cardSignal, ok := signals["card"]
    if !ok {
        return 0, ""
    }

    ipSignal := signals["ip"]

    cardCountry := cardSignal.Data["country"].(string)
    ipCountry := ipSignal.Data["country"].(string)

    if cardCountry != ipCountry {
        return 20, fmt.Sprintf("Card country (%s) differs from IP country (%s)", cardCountry, ipCountry)
    }
    return 0, ""
}
```

### Velocity Checker

```go
// internal/fraud/velocity.go
package fraud

import (
    "context"
    "time"
)

type VelocityChecker struct {
    redis RedisClient
    cfg   *VelocityConfig
}

type VelocityConfig struct {
    MaxOrdersPerHour      int
    MaxOrdersPerDay       int
    MaxCardsPerAccount    int
    MaxAccountsPerDevice  int
    MaxFailedPayments     int
}

func (v *VelocityChecker) Check(ctx context.Context, req *CheckRequest) (float64, []string) {
    var score float64
    var reasons []string

    // Orders per hour
    ordersPerHour, _ := v.getCount(ctx, fmt.Sprintf("velocity:orders:user:%s:hour", req.UserID), time.Hour)
    if ordersPerHour > v.cfg.MaxOrdersPerHour {
        score += 30
        reasons = append(reasons, fmt.Sprintf("Too many orders per hour: %d", ordersPerHour))
    }

    // Orders per day
    ordersPerDay, _ := v.getCount(ctx, fmt.Sprintf("velocity:orders:user:%s:day", req.UserID), 24*time.Hour)
    if ordersPerDay > v.cfg.MaxOrdersPerDay {
        score += 20
        reasons = append(reasons, fmt.Sprintf("Too many orders per day: %d", ordersPerDay))
    }

    // Cards per account
    cardsPerAccount, _ := v.getUniqueCount(ctx, fmt.Sprintf("velocity:cards:user:%s", req.UserID))
    if cardsPerAccount > v.cfg.MaxCardsPerAccount {
        score += 25
        reasons = append(reasons, fmt.Sprintf("Too many cards on account: %d", cardsPerAccount))
    }

    // Accounts per device
    accountsPerDevice, _ := v.getUniqueCount(ctx, fmt.Sprintf("velocity:accounts:device:%s", req.DeviceID))
    if accountsPerDevice > v.cfg.MaxAccountsPerDevice {
        score += 35
        reasons = append(reasons, fmt.Sprintf("Too many accounts on device: %d", accountsPerDevice))
    }

    // Failed payments
    failedPayments, _ := v.getCount(ctx, fmt.Sprintf("velocity:failed:user:%s:hour", req.UserID), time.Hour)
    if failedPayments > v.cfg.MaxFailedPayments {
        score += 40
        reasons = append(reasons, fmt.Sprintf("Too many failed payments: %d", failedPayments))
    }

    return score, reasons
}

func (v *VelocityChecker) Increment(ctx context.Context, key string, ttl time.Duration) {
    v.redis.Incr(ctx, key)
    v.redis.Expire(ctx, key, ttl)
}

func (v *VelocityChecker) AddUnique(ctx context.Context, key string, value string) {
    v.redis.SAdd(ctx, key, value)
}
```

### ML Model

```go
// internal/fraud/ml.go
package fraud

import (
    "context"

    ort "github.com/yalue/onnxruntime_go"
)

type MLModel struct {
    session *ort.Session
}

func NewMLModel(modelPath string) (*MLModel, error) {
    session, err := ort.NewSession(modelPath, nil)
    if err != nil {
        return nil, err
    }
    return &MLModel{session: session}, nil
}

func (m *MLModel) Predict(ctx context.Context, signals map[string]Signal) float64 {
    // Convert signals to feature vector
    features := m.extractFeatures(signals)

    // Run inference
    output, err := m.session.Run([]ort.Value{features})
    if err != nil {
        return 0
    }

    // Return fraud probability
    return output[0].GetData().([]float32)[0]
}

func (m *MLModel) extractFeatures(signals map[string]Signal) []float32 {
    features := make([]float32, 20) // Feature vector size

    // Device features
    if device, ok := signals["device"]; ok {
        features[0] = float32(device.Value)
        features[1] = float32(device.Data["accounts"].(int))
        features[2] = float32(device.Data["orders"].(int))
    }

    // IP features
    if ip, ok := signals["ip"]; ok {
        features[3] = float32(ip.Value)
        features[4] = boolToFloat(ip.Data["is_proxy"].(bool))
        features[5] = boolToFloat(ip.Data["is_vpn"].(bool))
        features[6] = boolToFloat(ip.Data["is_tor"].(bool))
    }

    // Email features
    if email, ok := signals["email"]; ok {
        features[7] = float32(email.Value)
        features[8] = boolToFloat(email.Data["is_disposable"].(bool))
    }

    // Behavior features
    if behavior, ok := signals["behavior"]; ok {
        features[9] = float32(behavior.Value)
        features[10] = float32(behavior.Data["session_duration"].(int))
        features[11] = float32(behavior.Data["pages_viewed"].(int))
    }

    return features
}
```

---

## API

### Check Transaction

```http
POST /api/v1/fraud/check
Content-Type: application/json
Authorization: Bearer <token>

{
    "type": "order",
    "user_id": "usr_123",
    "session_id": "sess_abc",
    "ip_address": "192.168.1.1",
    "device_id": "dev_xyz",
    "user_agent": "Mozilla/5.0...",
    "amount": 150000,
    "currency": "UAH",
    "email": "user@example.com",
    "card_bin": "424242"
}
```

**Response:**

```json
{
    "decision": "allow",
    "score": 15.5,
    "reasons": [],
    "signals": {
        "device": {
            "name": "device",
            "value": 5,
            "data": {
                "first_seen": "2024-01-01T00:00:00Z",
                "accounts": 1,
                "orders": 5
            }
        },
        "ip": {
            "name": "ip",
            "value": 10,
            "data": {
                "country": "UA",
                "is_proxy": false,
                "is_vpn": false
            }
        }
    },
    "request_id": "frq_abc123",
    "checked_at": "2024-01-15T10:30:00Z"
}
```

---

## Admin Dashboard

### Review Queue

```tsx
// components/admin/fraud/ReviewQueue.tsx
export function FraudReviewQueue() {
  const { data: reviews } = useQuery({
    queryKey: ['fraud-reviews'],
    queryFn: () => fetch('/api/admin/fraud/reviews').then(r => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/fraud/reviews/${id}/approve`, { method: 'POST' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/fraud/reviews/${id}/reject`, { method: 'POST' }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Fraud Review Queue</h2>

      <table className="table w-full">
        <thead>
          <tr>
            <th>Order</th>
            <th>Score</th>
            <th>Reasons</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reviews?.map((review: any) => (
            <tr key={review.id}>
              <td>{review.order_number}</td>
              <td>
                <span className={`badge ${getScoreColor(review.score)}`}>
                  {review.score.toFixed(1)}
                </span>
              </td>
              <td>
                <ul className="text-sm">
                  {review.reasons.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </td>
              <td>{formatPrice(review.amount)}</td>
              <td className="space-x-2">
                <button
                  onClick={() => approveMutation.mutate(review.id)}
                  className="btn btn-success btn-sm"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectMutation.mutate(review.id)}
                  className="btn btn-error btn-sm"
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Моніторинг

```yaml
groups:
  - name: fraud
    rules:
      - alert: HighFraudRate
        expr: |
          sum(rate(fraud_check_total{decision="block"}[1h])) /
          sum(rate(fraud_check_total[1h])) > 0.05
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High fraud block rate (> 5%)"

      - alert: FraudReviewQueueBacklog
        expr: fraud_review_queue_size > 100
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Fraud review queue backlog"
```
