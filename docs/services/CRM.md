# CRM Service

Customer Relationship Management service for customer data, segmentation, and engagement.

## Overview

| Property | Value |
|----------|-------|
| Port | 8084 |
| Technology | Go 1.24 |
| Database | PostgreSQL 15 |

## Features

- Customer profile management
- Customer segmentation (RFM)
- Customer Lifetime Value (CLV)
- Order history tracking
- Communication preferences
- Loyalty tier management
- Customer analytics

## API Endpoints

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customers` | List customers |
| GET | `/api/v1/customers/:id` | Get customer |
| POST | `/api/v1/customers` | Create customer |
| PUT | `/api/v1/customers/:id` | Update customer |
| DELETE | `/api/v1/customers/:id` | Delete customer |
| GET | `/api/v1/customers/:id/orders` | Get customer orders |
| GET | `/api/v1/customers/:id/activity` | Get activity log |

### Segments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/segments` | List segments |
| GET | `/api/v1/segments/:id` | Get segment |
| POST | `/api/v1/segments` | Create segment |
| GET | `/api/v1/segments/:id/customers` | Get customers in segment |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customers/:id/clv` | Get CLV |
| GET | `/api/v1/analytics/rfm` | RFM analysis |
| GET | `/api/v1/analytics/cohorts` | Cohort analysis |

## Data Models

### Customer

```go
type Customer struct {
    ID              string            `json:"id"`
    TenantID        string            `json:"tenant_id"`
    Email           string            `json:"email"`
    Phone           string            `json:"phone"`
    FirstName       string            `json:"first_name"`
    LastName        string            `json:"last_name"`
    DateOfBirth     *time.Time        `json:"date_of_birth,omitempty"`
    Gender          string            `json:"gender,omitempty"`
    Addresses       []Address         `json:"addresses"`
    Tags            []string          `json:"tags"`
    Source          string            `json:"source"`       // how they signed up

    // Loyalty
    LoyaltyTier     string            `json:"loyalty_tier"`
    LoyaltyPoints   int               `json:"loyalty_points"`

    // Analytics
    TotalOrders     int               `json:"total_orders"`
    TotalSpent      decimal.Decimal   `json:"total_spent"`
    AverageOrder    decimal.Decimal   `json:"average_order"`
    LastOrderDate   *time.Time        `json:"last_order_date"`

    // RFM
    RFMSegment      string            `json:"rfm_segment"`
    RecencyScore    int               `json:"recency_score"`
    FrequencyScore  int               `json:"frequency_score"`
    MonetaryScore   int               `json:"monetary_score"`

    // Communication
    EmailOptIn      bool              `json:"email_opt_in"`
    SMSOptIn        bool              `json:"sms_opt_in"`
    PushOptIn       bool              `json:"push_opt_in"`

    CreatedAt       time.Time         `json:"created_at"`
    UpdatedAt       time.Time         `json:"updated_at"`
}
```

### Segment

```go
type Segment struct {
    ID          string          `json:"id"`
    TenantID    string          `json:"tenant_id"`
    Name        string          `json:"name"`
    Description string          `json:"description"`
    Type        SegmentType     `json:"type"`      // manual, dynamic
    Conditions  []Condition     `json:"conditions"` // for dynamic segments
    CustomerCount int           `json:"customer_count"`
    CreatedAt   time.Time       `json:"created_at"`
    UpdatedAt   time.Time       `json:"updated_at"`
}

type Condition struct {
    Field    string `json:"field"`
    Operator string `json:"operator"` // eq, neq, gt, lt, gte, lte, in, between
    Value    any    `json:"value"`
}
```

## RFM Segmentation

### Scoring

| Score | Recency | Frequency | Monetary |
|-------|---------|-----------|----------|
| 5 | 0-30 days | 10+ orders | Top 20% |
| 4 | 31-60 days | 5-9 orders | 60-80% |
| 3 | 61-90 days | 3-4 orders | 40-60% |
| 2 | 91-180 days | 2 orders | 20-40% |
| 1 | 180+ days | 1 order | Bottom 20% |

### Segments

| Segment | RFM Score | Description |
|---------|-----------|-------------|
| Champions | 555, 554, 545 | Best customers |
| Loyal Customers | 543, 444, 435 | Frequent buyers |
| Potential Loyalists | 553, 551, 532 | Recent, could become loyal |
| New Customers | 512, 511, 412 | Recent first purchase |
| Promising | 525, 524, 513 | Recent, potential |
| Need Attention | 333, 332, 321 | Average, need engagement |
| About to Sleep | 231, 241, 251 | Haven't bought recently |
| At Risk | 155, 154, 144 | Were good customers |
| Can't Lose Them | 155, 254, 245 | Big spenders at risk |
| Hibernating | 122, 121, 112 | Long gone |
| Lost | 111 | Lost customers |

### API Usage

```bash
# Get RFM analysis
curl http://localhost:8084/api/v1/analytics/rfm

# Response
{
  "segments": [
    {
      "name": "Champions",
      "count": 150,
      "percentage": 15,
      "avgRevenue": 5000,
      "totalRevenue": 750000
    },
    ...
  ],
  "distribution": {
    "recency": { "1": 200, "2": 180, ... },
    "frequency": { ... },
    "monetary": { ... }
  }
}
```

## Customer Lifecycle

```
New ──▶ Active ──▶ At Risk ──▶ Lost
  │        │          │
  │        ▼          │
  │    Loyal ────────┘
  │        │
  │        ▼
  └──▶ Champion
```

## Events

### Published

| Event | Trigger | Payload |
|-------|---------|---------|
| `customer.created` | New signup | Customer data |
| `customer.updated` | Profile change | Changes |
| `customer.segment_changed` | Segment update | Old/new segment |
| `customer.tier_changed` | Loyalty tier change | Old/new tier |

### Consumed

| Event | Source | Action |
|-------|--------|--------|
| `order.created` | OMS | Update customer stats |
| `order.completed` | OMS | Add loyalty points |
| `user.registered` | Auth | Create customer profile |

## Configuration

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/shop_crm
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# RFM settings
RFM_RECENCY_DAYS=180
RFM_CALCULATION_INTERVAL=24h

# Loyalty
LOYALTY_POINTS_PER_UAH=1
LOYALTY_TIER_THRESHOLDS=0,1000,5000,15000,50000
```

## Running

```bash
cd services/crm
go run cmd/server/main.go
```
