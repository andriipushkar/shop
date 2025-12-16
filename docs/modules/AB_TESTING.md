# A/B Testing

Система експериментів та A/B тестування.

## Огляд

| Параметр | Значення |
|----------|----------|
| Engine | Custom + Statsig compatible |
| Assignment | Deterministic (hash) |
| Statistics | Bayesian |

### Можливості

- Feature flags
- A/B/n тести
- Multivariate тести
- Поступовий rollout
- Статистичний аналіз

---

## Архітектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  AB Service │────▶│   Results   │
│  (Request)  │     │             │     │  (Events)   │
└─────────────┘     │  - Assign   │     └─────────────┘
                    │  - Track    │
                    │  - Analyze  │
                    └─────────────┘
```

---

## Конфігурація

```env
# A/B Testing
AB_ENABLED=true
AB_DEFAULT_TRAFFIC=100
AB_STATS_CONFIDENCE=0.95
```

---

## Імплементація

### Data Models

```go
// internal/abtesting/models.go
package abtesting

import "time"

type Experiment struct {
    ID          string            `json:"id" gorm:"primaryKey"`
    Name        string            `json:"name"`
    Description string            `json:"description"`
    Type        ExperimentType    `json:"type"` // ab, multivariate, feature_flag
    Status      ExperimentStatus  `json:"status"`
    Variants    []Variant         `json:"variants" gorm:"foreignKey:ExperimentID"`
    TargetRules []TargetRule      `json:"target_rules" gorm:"foreignKey:ExperimentID"`
    Metrics     []Metric          `json:"metrics" gorm:"foreignKey:ExperimentID"`
    Traffic     int               `json:"traffic"` // % of users
    StartDate   *time.Time        `json:"start_date"`
    EndDate     *time.Time        `json:"end_date"`
    CreatedAt   time.Time         `json:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at"`
}

type ExperimentType string

const (
    TypeAB           ExperimentType = "ab"
    TypeMultivariate ExperimentType = "multivariate"
    TypeFeatureFlag  ExperimentType = "feature_flag"
)

type ExperimentStatus string

const (
    StatusDraft    ExperimentStatus = "draft"
    StatusRunning  ExperimentStatus = "running"
    StatusPaused   ExperimentStatus = "paused"
    StatusComplete ExperimentStatus = "complete"
)

type Variant struct {
    ID           string                 `json:"id" gorm:"primaryKey"`
    ExperimentID string                 `json:"experiment_id"`
    Name         string                 `json:"name"`
    Description  string                 `json:"description"`
    Weight       int                    `json:"weight"` // % weight
    IsControl    bool                   `json:"is_control"`
    Config       map[string]interface{} `json:"config" gorm:"serializer:json"`
}

type TargetRule struct {
    ID           string `json:"id" gorm:"primaryKey"`
    ExperimentID string `json:"experiment_id"`
    Field        string `json:"field"`   // user.country, user.segment, device.type
    Operator     string `json:"operator"` // eq, neq, in, not_in, gt, lt
    Value        string `json:"value"`
}

type Metric struct {
    ID           string     `json:"id" gorm:"primaryKey"`
    ExperimentID string     `json:"experiment_id"`
    Name         string     `json:"name"`
    Type         MetricType `json:"type"`
    EventName    string     `json:"event_name"`
    IsPrimary    bool       `json:"is_primary"`
}

type MetricType string

const (
    MetricConversion MetricType = "conversion"
    MetricRevenue    MetricType = "revenue"
    MetricCount      MetricType = "count"
    MetricDuration   MetricType = "duration"
)

type Assignment struct {
    ID           string    `json:"id" gorm:"primaryKey"`
    ExperimentID string    `json:"experiment_id"`
    VariantID    string    `json:"variant_id"`
    UserID       string    `json:"user_id"`
    SessionID    string    `json:"session_id"`
    AssignedAt   time.Time `json:"assigned_at"`
}

type Event struct {
    ID           string                 `json:"id" gorm:"primaryKey"`
    ExperimentID string                 `json:"experiment_id"`
    VariantID    string                 `json:"variant_id"`
    UserID       string                 `json:"user_id"`
    EventName    string                 `json:"event_name"`
    Value        float64                `json:"value"`
    Metadata     map[string]interface{} `json:"metadata" gorm:"serializer:json"`
    CreatedAt    time.Time              `json:"created_at"`
}
```

### AB Service

```go
// internal/abtesting/service.go
package abtesting

import (
    "context"
    "crypto/sha256"
    "encoding/binary"
)

type Service struct {
    repo        Repository
    eventBus    EventBus
    cache       Cache
}

type UserContext struct {
    UserID    string
    SessionID string
    Country   string
    Segment   string
    Device    string
    IsNew     bool
    Attributes map[string]interface{}
}

type AssignmentResult struct {
    ExperimentID   string                 `json:"experiment_id"`
    ExperimentName string                 `json:"experiment_name"`
    VariantID      string                 `json:"variant_id"`
    VariantName    string                 `json:"variant_name"`
    Config         map[string]interface{} `json:"config"`
    IsControl      bool                   `json:"is_control"`
}

// GetAssignments повертає всі активні експерименти для користувача
func (s *Service) GetAssignments(ctx context.Context, user *UserContext) ([]AssignmentResult, error) {
    // Get all running experiments
    experiments, err := s.repo.FindRunningExperiments(ctx)
    if err != nil {
        return nil, err
    }

    results := make([]AssignmentResult, 0)

    for _, exp := range experiments {
        // Check targeting rules
        if !s.matchesTargeting(user, exp.TargetRules) {
            continue
        }

        // Check if user is in traffic allocation
        if !s.isInTraffic(user.UserID, exp.ID, exp.Traffic) {
            continue
        }

        // Get or create assignment
        variant, err := s.getOrCreateAssignment(ctx, user, &exp)
        if err != nil {
            continue
        }

        results = append(results, AssignmentResult{
            ExperimentID:   exp.ID,
            ExperimentName: exp.Name,
            VariantID:      variant.ID,
            VariantName:    variant.Name,
            Config:         variant.Config,
            IsControl:      variant.IsControl,
        })
    }

    return results, nil
}

// GetVariant повертає варіант для конкретного експерименту
func (s *Service) GetVariant(ctx context.Context, experimentID string, user *UserContext) (*AssignmentResult, error) {
    exp, err := s.repo.FindExperimentByID(ctx, experimentID)
    if err != nil {
        return nil, err
    }

    if exp.Status != StatusRunning {
        return nil, ErrExperimentNotRunning
    }

    // Check targeting
    if !s.matchesTargeting(user, exp.TargetRules) {
        return nil, ErrNotTargeted
    }

    // Check traffic
    if !s.isInTraffic(user.UserID, exp.ID, exp.Traffic) {
        return nil, ErrNotInTraffic
    }

    variant, err := s.getOrCreateAssignment(ctx, user, exp)
    if err != nil {
        return nil, err
    }

    return &AssignmentResult{
        ExperimentID:   exp.ID,
        ExperimentName: exp.Name,
        VariantID:      variant.ID,
        VariantName:    variant.Name,
        Config:         variant.Config,
        IsControl:      variant.IsControl,
    }, nil
}

// getOrCreateAssignment детерміновано присвоює варіант
func (s *Service) getOrCreateAssignment(ctx context.Context, user *UserContext, exp *Experiment) (*Variant, error) {
    // Check existing assignment
    existing, err := s.repo.FindAssignment(ctx, exp.ID, user.UserID)
    if err == nil && existing != nil {
        return s.repo.FindVariantByID(ctx, existing.VariantID)
    }

    // Deterministic assignment using hash
    variant := s.assignVariant(user.UserID, exp)

    // Save assignment
    assignment := &Assignment{
        ID:           generateID("asg"),
        ExperimentID: exp.ID,
        VariantID:    variant.ID,
        UserID:       user.UserID,
        SessionID:    user.SessionID,
        AssignedAt:   time.Now(),
    }

    if err := s.repo.CreateAssignment(ctx, assignment); err != nil {
        return nil, err
    }

    // Track assignment event
    s.eventBus.Publish("experiment.assigned", map[string]interface{}{
        "experiment_id": exp.ID,
        "variant_id":    variant.ID,
        "user_id":       user.UserID,
    })

    return variant, nil
}

// assignVariant детерміновано вибирає варіант на основі hash
func (s *Service) assignVariant(userID string, exp *Experiment) *Variant {
    // Create deterministic hash
    hash := sha256.Sum256([]byte(userID + exp.ID))
    bucket := binary.BigEndian.Uint32(hash[:4]) % 100

    // Find variant by weight
    var cumulative uint32 = 0
    for _, variant := range exp.Variants {
        cumulative += uint32(variant.Weight)
        if bucket < cumulative {
            return &variant
        }
    }

    // Fallback to control
    for _, variant := range exp.Variants {
        if variant.IsControl {
            return &variant
        }
    }

    return &exp.Variants[0]
}

func (s *Service) isInTraffic(userID, experimentID string, traffic int) bool {
    hash := sha256.Sum256([]byte(userID + experimentID + "traffic"))
    bucket := binary.BigEndian.Uint32(hash[:4]) % 100
    return int(bucket) < traffic
}

func (s *Service) matchesTargeting(user *UserContext, rules []TargetRule) bool {
    for _, rule := range rules {
        if !s.evaluateRule(user, &rule) {
            return false
        }
    }
    return true
}

func (s *Service) evaluateRule(user *UserContext, rule *TargetRule) bool {
    var value interface{}

    switch rule.Field {
    case "user.country":
        value = user.Country
    case "user.segment":
        value = user.Segment
    case "device.type":
        value = user.Device
    case "user.is_new":
        value = user.IsNew
    default:
        value = user.Attributes[rule.Field]
    }

    switch rule.Operator {
    case "eq":
        return fmt.Sprintf("%v", value) == rule.Value
    case "neq":
        return fmt.Sprintf("%v", value) != rule.Value
    case "in":
        values := strings.Split(rule.Value, ",")
        for _, v := range values {
            if fmt.Sprintf("%v", value) == strings.TrimSpace(v) {
                return true
            }
        }
        return false
    default:
        return true
    }
}
```

### Event Tracking

```go
// internal/abtesting/tracking.go
package abtesting

import (
    "context"
    "time"
)

// TrackEvent записує подію для аналітики
func (s *Service) TrackEvent(ctx context.Context, experimentID, variantID, userID, eventName string, value float64, metadata map[string]interface{}) error {
    event := &Event{
        ID:           generateID("evt"),
        ExperimentID: experimentID,
        VariantID:    variantID,
        UserID:       userID,
        EventName:    eventName,
        Value:        value,
        Metadata:     metadata,
        CreatedAt:    time.Now(),
    }

    return s.repo.CreateEvent(ctx, event)
}

// TrackConversion записує конверсію
func (s *Service) TrackConversion(ctx context.Context, userID, eventName string, value float64) error {
    // Get all user's assignments
    assignments, err := s.repo.FindUserAssignments(ctx, userID)
    if err != nil {
        return err
    }

    // Track for each experiment
    for _, assignment := range assignments {
        if err := s.TrackEvent(ctx, assignment.ExperimentID, assignment.VariantID, userID, eventName, value, nil); err != nil {
            log.Printf("Failed to track event: %v", err)
        }
    }

    return nil
}
```

### Statistics

```go
// internal/abtesting/statistics.go
package abtesting

import (
    "context"
    "math"
)

type ExperimentResults struct {
    ExperimentID string          `json:"experiment_id"`
    Variants     []VariantResult `json:"variants"`
    Winner       *string         `json:"winner,omitempty"`
    IsSignificant bool           `json:"is_significant"`
}

type VariantResult struct {
    VariantID      string  `json:"variant_id"`
    VariantName    string  `json:"variant_name"`
    IsControl      bool    `json:"is_control"`
    Participants   int     `json:"participants"`
    Conversions    int     `json:"conversions"`
    ConversionRate float64 `json:"conversion_rate"`
    Revenue        float64 `json:"revenue"`
    RevenuePerUser float64 `json:"revenue_per_user"`
    Improvement    float64 `json:"improvement"` // vs control
    PValue         float64 `json:"p_value"`
    ConfidenceInterval CI `json:"confidence_interval"`
}

type CI struct {
    Lower float64 `json:"lower"`
    Upper float64 `json:"upper"`
}

// GetResults обчислює результати експерименту
func (s *Service) GetResults(ctx context.Context, experimentID string) (*ExperimentResults, error) {
    exp, err := s.repo.FindExperimentByID(ctx, experimentID)
    if err != nil {
        return nil, err
    }

    results := &ExperimentResults{
        ExperimentID: experimentID,
        Variants:     make([]VariantResult, len(exp.Variants)),
    }

    var controlResult *VariantResult

    for i, variant := range exp.Variants {
        // Get stats for variant
        stats, err := s.repo.GetVariantStats(ctx, experimentID, variant.ID)
        if err != nil {
            return nil, err
        }

        convRate := 0.0
        if stats.Participants > 0 {
            convRate = float64(stats.Conversions) / float64(stats.Participants)
        }

        rpu := 0.0
        if stats.Participants > 0 {
            rpu = stats.Revenue / float64(stats.Participants)
        }

        result := VariantResult{
            VariantID:      variant.ID,
            VariantName:    variant.Name,
            IsControl:      variant.IsControl,
            Participants:   stats.Participants,
            Conversions:    stats.Conversions,
            ConversionRate: convRate,
            Revenue:        stats.Revenue,
            RevenuePerUser: rpu,
        }

        // Calculate confidence interval
        result.ConfidenceInterval = s.calculateCI(stats.Conversions, stats.Participants, 0.95)

        results.Variants[i] = result

        if variant.IsControl {
            controlResult = &result
        }
    }

    // Calculate improvements and significance
    if controlResult != nil {
        for i := range results.Variants {
            if !results.Variants[i].IsControl {
                results.Variants[i].Improvement = s.calculateImprovement(
                    results.Variants[i].ConversionRate,
                    controlResult.ConversionRate,
                )
                results.Variants[i].PValue = s.calculatePValue(
                    results.Variants[i].Conversions,
                    results.Variants[i].Participants,
                    controlResult.Conversions,
                    controlResult.Participants,
                )
            }
        }

        // Determine winner
        results.Winner, results.IsSignificant = s.determineWinner(results.Variants)
    }

    return results, nil
}

func (s *Service) calculateCI(successes, trials int, confidence float64) CI {
    if trials == 0 {
        return CI{0, 0}
    }

    p := float64(successes) / float64(trials)
    z := 1.96 // 95% confidence

    se := math.Sqrt(p * (1 - p) / float64(trials))

    return CI{
        Lower: math.Max(0, p-z*se),
        Upper: math.Min(1, p+z*se),
    }
}

func (s *Service) calculateImprovement(treatment, control float64) float64 {
    if control == 0 {
        return 0
    }
    return (treatment - control) / control * 100
}

func (s *Service) calculatePValue(convA, partA, convB, partB int) float64 {
    // Chi-squared test for proportions
    // Simplified implementation
    pA := float64(convA) / float64(partA)
    pB := float64(convB) / float64(partB)
    pPooled := float64(convA+convB) / float64(partA+partB)

    se := math.Sqrt(pPooled * (1 - pPooled) * (1/float64(partA) + 1/float64(partB)))
    if se == 0 {
        return 1
    }

    z := (pA - pB) / se
    pValue := 2 * (1 - normalCDF(math.Abs(z)))

    return pValue
}

func (s *Service) determineWinner(variants []VariantResult) (*string, bool) {
    var bestVariant *VariantResult
    for i := range variants {
        if !variants[i].IsControl && variants[i].PValue < 0.05 {
            if bestVariant == nil || variants[i].Improvement > bestVariant.Improvement {
                bestVariant = &variants[i]
            }
        }
    }

    if bestVariant != nil {
        return &bestVariant.VariantID, true
    }
    return nil, false
}
```

---

## API Endpoints

### Get Assignments

```http
GET /api/v1/experiments/assignments
Authorization: Bearer <token>
```

**Response:**

```json
{
  "assignments": [
    {
      "experiment_id": "exp_123",
      "experiment_name": "checkout_redesign",
      "variant_id": "var_456",
      "variant_name": "new_checkout",
      "config": {
        "show_progress_bar": true,
        "button_color": "green"
      },
      "is_control": false
    }
  ]
}
```

### Track Event

```http
POST /api/v1/experiments/track
Authorization: Bearer <token>
Content-Type: application/json

{
    "event_name": "purchase",
    "value": 150000,
    "metadata": {
        "order_id": "ord_123"
    }
}
```

### Get Results (Admin)

```http
GET /api/admin/experiments/{id}/results
Authorization: Bearer <admin_token>
```

---

## Frontend SDK

```typescript
// lib/ab-testing.ts
class ABTestingClient {
  private assignments: Map<string, AssignmentResult> = new Map();

  async initialize(userId: string) {
    const response = await fetch('/api/v1/experiments/assignments', {
      headers: { 'X-User-ID': userId },
    });
    const data = await response.json();

    for (const assignment of data.assignments) {
      this.assignments.set(assignment.experiment_id, assignment);
    }
  }

  getVariant(experimentId: string): AssignmentResult | undefined {
    return this.assignments.get(experimentId);
  }

  getConfig<T>(experimentId: string, defaultConfig: T): T {
    const assignment = this.assignments.get(experimentId);
    if (!assignment) return defaultConfig;
    return { ...defaultConfig, ...assignment.config } as T;
  }

  async trackEvent(eventName: string, value?: number, metadata?: object) {
    await fetch('/api/v1/experiments/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, value, metadata }),
    });
  }
}

export const abTesting = new ABTestingClient();
```

### React Hook

```tsx
// hooks/useExperiment.ts
import { useEffect, useState } from 'react';
import { abTesting } from '@/lib/ab-testing';

export function useExperiment<T>(experimentId: string, defaultConfig: T) {
  const [config, setConfig] = useState<T>(defaultConfig);
  const [variant, setVariant] = useState<string | null>(null);

  useEffect(() => {
    const assignment = abTesting.getVariant(experimentId);
    if (assignment) {
      setConfig({ ...defaultConfig, ...assignment.config } as T);
      setVariant(assignment.variant_name);
    }
  }, [experimentId]);

  return { config, variant };
}

// Usage
function CheckoutPage() {
  const { config, variant } = useExperiment('checkout_redesign', {
    showProgressBar: false,
    buttonColor: 'blue',
  });

  return (
    <div>
      {config.showProgressBar && <ProgressBar />}
      <Button color={config.buttonColor}>Checkout</Button>
    </div>
  );
}
```

---

## Admin Interface

```tsx
// components/admin/experiments/ExperimentDashboard.tsx
export function ExperimentDashboard() {
  const { data: experiments } = useQuery({
    queryKey: ['experiments'],
    queryFn: () => fetch('/api/admin/experiments').then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">A/B Experiments</h1>
        <Link href="/admin/experiments/new">
          <Button>Create Experiment</Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {experiments?.map((exp: any) => (
          <Card key={exp.id}>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle>{exp.name}</CardTitle>
                  <CardDescription>{exp.description}</CardDescription>
                </div>
                <Badge variant={exp.status}>{exp.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Traffic</span>
                  <p className="font-medium">{exp.traffic}%</p>
                </div>
                <div>
                  <span className="text-gray-500">Variants</span>
                  <p className="font-medium">{exp.variants.length}</p>
                </div>
                <div>
                  <span className="text-gray-500">Participants</span>
                  <p className="font-medium">{exp.total_participants}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="font-medium">{exp.duration_days} days</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/admin/experiments/${exp.id}`}>
                <Button variant="outline">View Results</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
```
