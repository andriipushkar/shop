# CRM Service Architecture

Архітектура сервісу управління клієнтами.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CRM ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  External ────┐                                                             │
│  Sources      │     ┌─────────────┐     ┌─────────────┐                    │
│  ├── Website ─┼────▶│ CRM Service │────▶│ PostgreSQL  │                    │
│  ├── API     ─┤     │             │     └─────────────┘                    │
│  ├── Import  ─┤     │ ┌─────────┐ │     ┌─────────────┐                    │
│  └── Events  ─┘     │ │Customer │ │────▶│ Elasticsearch│                   │
│                     │ │360 View │ │     └─────────────┘                    │
│                     │ └─────────┘ │     ┌─────────────┐                    │
│                     │             │────▶│ Redis Cache │                    │
│                     └─────────────┘     └─────────────┘                    │
│                           │                                                 │
│                           ▼                                                 │
│                   ┌─────────────────┐                                      │
│                   │ Event Bus       │                                      │
│                   │ (RabbitMQ)      │                                      │
│                   └─────────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Domain Model

### Customer Entity

```go
// internal/domain/customer.go
package domain

type Customer struct {
    ID            string         `json:"id"`
    Email         string         `json:"email"`
    Phone         string         `json:"phone"`
    FirstName     string         `json:"first_name"`
    LastName      string         `json:"last_name"`
    Status        CustomerStatus `json:"status"`
    Segment       Segment        `json:"segment"`
    Tags          []string       `json:"tags"`
    Addresses     []Address      `json:"addresses"`
    Preferences   Preferences    `json:"preferences"`
    Metrics       CustomerMetrics `json:"metrics"`
    CreatedAt     time.Time      `json:"created_at"`
    UpdatedAt     time.Time      `json:"updated_at"`
    LastActivityAt time.Time     `json:"last_activity_at"`
}

type CustomerStatus string

const (
    CustomerStatusActive    CustomerStatus = "active"
    CustomerStatusInactive  CustomerStatus = "inactive"
    CustomerStatusBlocked   CustomerStatus = "blocked"
    CustomerStatusDeleted   CustomerStatus = "deleted"
)

type Segment string

const (
    SegmentNew       Segment = "new"
    SegmentRegular   Segment = "regular"
    SegmentVIP       Segment = "vip"
    SegmentChurned   Segment = "churned"
    SegmentAtRisk    Segment = "at_risk"
)

type CustomerMetrics struct {
    TotalOrders     int       `json:"total_orders"`
    TotalSpent      float64   `json:"total_spent"`
    AverageOrder    float64   `json:"average_order"`
    FirstOrderDate  time.Time `json:"first_order_date"`
    LastOrderDate   time.Time `json:"last_order_date"`
    LifetimeValue   float64   `json:"lifetime_value"`
    NPS             *int      `json:"nps"`
}

type Preferences struct {
    Language       string   `json:"language"`
    Currency       string   `json:"currency"`
    Newsletter     bool     `json:"newsletter"`
    SmsNotifications bool   `json:"sms_notifications"`
    Categories     []string `json:"categories"`
}
```

### Customer Events

```go
// internal/domain/events.go
package domain

type CustomerEvent struct {
    ID          string                 `json:"id"`
    CustomerID  string                 `json:"customer_id"`
    Type        CustomerEventType      `json:"type"`
    Data        map[string]interface{} `json:"data"`
    Source      string                 `json:"source"`
    Timestamp   time.Time              `json:"timestamp"`
}

type CustomerEventType string

const (
    EventCustomerCreated    CustomerEventType = "customer.created"
    EventCustomerUpdated    CustomerEventType = "customer.updated"
    EventCustomerDeleted    CustomerEventType = "customer.deleted"
    EventOrderPlaced        CustomerEventType = "order.placed"
    EventOrderCompleted     CustomerEventType = "order.completed"
    EventProductViewed      CustomerEventType = "product.viewed"
    EventCartAbandoned      CustomerEventType = "cart.abandoned"
    EventReviewSubmitted    CustomerEventType = "review.submitted"
    EventSupportTicket      CustomerEventType = "support.ticket"
    EventNewsletterSubscribed CustomerEventType = "newsletter.subscribed"
)
```

## Service Layer

### Customer Service

```go
// internal/service/customer_service.go
package service

type CustomerService struct {
    repo           CustomerRepository
    eventPublisher EventPublisher
    cache          Cache
    segmenter      Segmenter
    logger         *zerolog.Logger
}

func NewCustomerService(
    repo CustomerRepository,
    eventPublisher EventPublisher,
    cache Cache,
    segmenter Segmenter,
) *CustomerService {
    return &CustomerService{
        repo:           repo,
        eventPublisher: eventPublisher,
        cache:          cache,
        segmenter:      segmenter,
    }
}

func (s *CustomerService) GetCustomer(ctx context.Context, id string) (*domain.Customer, error) {
    // Try cache first
    cacheKey := fmt.Sprintf("customer:%s", id)
    if cached, err := s.cache.Get(ctx, cacheKey); err == nil {
        var customer domain.Customer
        if json.Unmarshal(cached, &customer) == nil {
            return &customer, nil
        }
    }

    // Fetch from database
    customer, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Cache for 5 minutes
    if data, err := json.Marshal(customer); err == nil {
        s.cache.Set(ctx, cacheKey, data, 5*time.Minute)
    }

    return customer, nil
}

func (s *CustomerService) GetCustomer360(ctx context.Context, id string) (*Customer360View, error) {
    customer, err := s.GetCustomer(ctx, id)
    if err != nil {
        return nil, err
    }

    // Fetch related data in parallel
    var wg sync.WaitGroup
    var orders []Order
    var events []CustomerEvent
    var tickets []SupportTicket
    var recommendations []Product

    wg.Add(4)
    go func() {
        defer wg.Done()
        orders, _ = s.repo.GetCustomerOrders(ctx, id, 10)
    }()
    go func() {
        defer wg.Done()
        events, _ = s.repo.GetCustomerEvents(ctx, id, 50)
    }()
    go func() {
        defer wg.Done()
        tickets, _ = s.repo.GetCustomerTickets(ctx, id)
    }()
    go func() {
        defer wg.Done()
        recommendations, _ = s.recommendationService.GetForCustomer(ctx, id, 10)
    }()
    wg.Wait()

    return &Customer360View{
        Customer:        customer,
        RecentOrders:    orders,
        RecentActivity:  events,
        SupportTickets:  tickets,
        Recommendations: recommendations,
        Timeline:        s.buildTimeline(orders, events, tickets),
    }, nil
}

func (s *CustomerService) UpdateSegment(ctx context.Context, customerID string) error {
    customer, err := s.repo.GetByID(ctx, customerID)
    if err != nil {
        return err
    }

    // Calculate new segment
    newSegment := s.segmenter.Calculate(customer)
    if newSegment == customer.Segment {
        return nil // No change
    }

    // Update segment
    customer.Segment = newSegment
    if err := s.repo.Update(ctx, customer); err != nil {
        return err
    }

    // Publish event
    s.eventPublisher.Publish(ctx, &CustomerEvent{
        Type:       "customer.segment_changed",
        CustomerID: customerID,
        Data: map[string]interface{}{
            "old_segment": customer.Segment,
            "new_segment": newSegment,
        },
    })

    // Invalidate cache
    s.cache.Delete(ctx, fmt.Sprintf("customer:%s", customerID))

    return nil
}
```

### Segmentation Service

```go
// internal/service/segmenter.go
package service

type Segmenter struct {
    config SegmentConfig
}

type SegmentConfig struct {
    VIPThreshold     float64       // Minimum LTV for VIP
    ChurnDays        int           // Days without activity for churned
    AtRiskDays       int           // Days without activity for at-risk
    NewCustomerDays  int           // Days to be considered new
}

func (s *Segmenter) Calculate(customer *domain.Customer) domain.Segment {
    daysSinceLastOrder := int(time.Since(customer.Metrics.LastOrderDate).Hours() / 24)
    daysSinceCreated := int(time.Since(customer.CreatedAt).Hours() / 24)

    // Check VIP first (highest priority)
    if customer.Metrics.LifetimeValue >= s.config.VIPThreshold {
        return domain.SegmentVIP
    }

    // Check churned
    if daysSinceLastOrder > s.config.ChurnDays {
        return domain.SegmentChurned
    }

    // Check at-risk
    if daysSinceLastOrder > s.config.AtRiskDays {
        return domain.SegmentAtRisk
    }

    // Check if new
    if daysSinceCreated <= s.config.NewCustomerDays {
        return domain.SegmentNew
    }

    return domain.SegmentRegular
}

// RFM Segmentation
func (s *Segmenter) CalculateRFM(customer *domain.Customer) RFMScore {
    return RFMScore{
        Recency:   s.calculateRecencyScore(customer),
        Frequency: s.calculateFrequencyScore(customer),
        Monetary:  s.calculateMonetaryScore(customer),
    }
}

type RFMScore struct {
    Recency   int // 1-5, 5 being best (most recent)
    Frequency int // 1-5, 5 being best (most frequent)
    Monetary  int // 1-5, 5 being best (highest value)
}
```

## Event Processing

### Event Handler

```go
// internal/handler/event_handler.go
package handler

type CustomerEventHandler struct {
    customerService *service.CustomerService
    notificationService *service.NotificationService
    analyticsService *service.AnalyticsService
}

func (h *CustomerEventHandler) HandleOrderCompleted(ctx context.Context, event *OrderCompletedEvent) error {
    customerID := event.CustomerID

    // Update customer metrics
    if err := h.customerService.UpdateMetrics(ctx, customerID, event); err != nil {
        return err
    }

    // Recalculate segment
    if err := h.customerService.UpdateSegment(ctx, customerID); err != nil {
        return err
    }

    // Track for analytics
    h.analyticsService.TrackPurchase(ctx, customerID, event.OrderID, event.Total)

    // Check for milestone achievements
    customer, _ := h.customerService.GetCustomer(ctx, customerID)
    if milestone := h.checkMilestone(customer); milestone != nil {
        h.notificationService.SendMilestoneNotification(ctx, customerID, milestone)
    }

    return nil
}

func (h *CustomerEventHandler) HandleCartAbandoned(ctx context.Context, event *CartAbandonedEvent) error {
    // Record event
    if err := h.customerService.RecordEvent(ctx, &domain.CustomerEvent{
        CustomerID: event.CustomerID,
        Type:       domain.EventCartAbandoned,
        Data: map[string]interface{}{
            "cart_id":    event.CartID,
            "cart_value": event.CartValue,
            "items":      event.Items,
        },
    }); err != nil {
        return err
    }

    // Trigger abandoned cart workflow
    return h.notificationService.TriggerAbandonedCartFlow(ctx, event)
}
```

## API Layer

### Customer API

```go
// internal/api/customer_handler.go
package api

type CustomerHandler struct {
    service *service.CustomerService
}

// GET /api/customers/:id
func (h *CustomerHandler) GetCustomer(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    customer, err := h.service.GetCustomer(ctx, id)
    if err != nil {
        handleError(w, err)
        return
    }

    json.NewEncoder(w).Encode(customer)
}

// GET /api/customers/:id/360
func (h *CustomerHandler) GetCustomer360(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    view, err := h.service.GetCustomer360(ctx, id)
    if err != nil {
        handleError(w, err)
        return
    }

    json.NewEncoder(w).Encode(view)
}

// POST /api/customers/search
func (h *CustomerHandler) SearchCustomers(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req SearchRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }

    results, err := h.service.Search(ctx, req)
    if err != nil {
        handleError(w, err)
        return
    }

    json.NewEncoder(w).Encode(results)
}

// POST /api/customers/:id/merge
func (h *CustomerHandler) MergeCustomers(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    primaryID := chi.URLParam(r, "id")

    var req MergeRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }

    merged, err := h.service.MergeCustomers(ctx, primaryID, req.SecondaryID)
    if err != nil {
        handleError(w, err)
        return
    }

    json.NewEncoder(w).Encode(merged)
}
```

## Search Integration

### Elasticsearch Mapping

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "email": {
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "phone": { "type": "keyword" },
      "first_name": { "type": "text" },
      "last_name": { "type": "text" },
      "full_name": { "type": "text" },
      "segment": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "status": { "type": "keyword" },
      "metrics": {
        "properties": {
          "total_orders": { "type": "integer" },
          "total_spent": { "type": "float" },
          "lifetime_value": { "type": "float" }
        }
      },
      "created_at": { "type": "date" },
      "last_activity_at": { "type": "date" }
    }
  }
}
```

### Search Service

```go
// internal/service/search_service.go
func (s *SearchService) SearchCustomers(ctx context.Context, req SearchRequest) (*SearchResult, error) {
    query := elastic.NewBoolQuery()

    // Full-text search
    if req.Query != "" {
        query.Must(elastic.NewMultiMatchQuery(req.Query,
            "email", "phone", "first_name", "last_name", "full_name").
            Type("best_fields").
            Fuzziness("AUTO"))
    }

    // Filters
    if req.Segment != "" {
        query.Filter(elastic.NewTermQuery("segment", req.Segment))
    }
    if req.Status != "" {
        query.Filter(elastic.NewTermQuery("status", req.Status))
    }
    if len(req.Tags) > 0 {
        query.Filter(elastic.NewTermsQuery("tags", req.Tags...))
    }

    // Date range
    if !req.CreatedAfter.IsZero() {
        query.Filter(elastic.NewRangeQuery("created_at").Gte(req.CreatedAfter))
    }

    result, err := s.client.Search().
        Index("customers").
        Query(query).
        From(req.Offset).
        Size(req.Limit).
        Sort("_score", false).
        Sort("last_activity_at", false).
        Do(ctx)

    if err != nil {
        return nil, err
    }

    return s.parseSearchResult(result), nil
}
```

## See Also

- [Admin Architecture](./ADMIN_ARCHITECTURE.md)
- [Notification Architecture](./NOTIFICATION_ARCHITECTURE.md)
- [CDP Module](../modules/CDP.md)
