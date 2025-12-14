# Analytics & Reporting

Comprehensive business intelligence and analytics for data-driven decisions.

## Overview

The analytics module provides:
- Sales analytics and trends
- Customer analytics (RFM, CLV, cohorts)
- Product performance metrics
- Conversion funnel analysis
- Real-time dashboards
- Custom report builder
- Automated reporting

## Dashboard Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      ANALYTICS DASHBOARD                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  KPIs (Real-time)                                               │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │ 150K   │  │ 1,250  │  │ 120₴   │  │ 3.2%   │  │ 4.5    │   │
│  │Revenue │  │Orders  │  │  AOV   │  │ Conv.  │  │Rating  │   │
│  │ +12%   │  │ +8%    │  │ +5%    │  │ -0.3%  │  │ =      │   │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘   │
│                                                                  │
│  Revenue Trend                      Orders by Status             │
│  ┌────────────────────────────┐    ┌───────────────────────┐   │
│  │     ╭─╮                    │    │ ■ Delivered    72%    │   │
│  │   ╭─╯ ╰─╮    ╭──╮         │    │ ■ Processing   15%    │   │
│  │ ╭─╯     ╰────╯  ╰─╮       │    │ ■ Pending       8%    │   │
│  │─╯                  ╰──    │    │ ■ Cancelled     5%    │   │
│  └────────────────────────────┘    └───────────────────────┘   │
│                                                                  │
│  Top Products                       Customer Segments            │
│  ┌────────────────────────────┐    ┌───────────────────────┐   │
│  │ 1. iPhone Case     ████   │    │ Champions      25%    │   │
│  │ 2. USB Cable       ███    │    │ Loyal          30%    │   │
│  │ 3. Screen Guard    ██     │    │ At Risk        15%    │   │
│  │ 4. Charger         ██     │    │ New            30%    │   │
│  └────────────────────────────┘    └───────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Sales Analytics

### Revenue Metrics

```typescript
interface SalesMetrics {
  revenue: number;
  revenueGrowth: number;        // % vs previous period
  orders: number;
  ordersGrowth: number;
  averageOrderValue: number;
  aovGrowth: number;
  itemsPerOrder: number;
  refundRate: number;
}

// Get sales metrics
const metrics = await analytics.getSalesMetrics({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  compareWith: 'previous_period', // or 'previous_year'
});
```

### Revenue Breakdown

```typescript
// By category
const byCategory = await analytics.getRevenueByCategory(dateRange);
// [{ category: 'Electronics', revenue: 50000, percentage: 40 }, ...]

// By product
const byProduct = await analytics.getTopProducts({
  ...dateRange,
  limit: 10,
  sortBy: 'revenue', // or 'quantity', 'margin'
});

// By channel
const byChannel = await analytics.getRevenueByChannel(dateRange);
// { direct: 60000, rozetka: 40000, prom: 25000 }

// By time (hourly, daily, weekly, monthly)
const trend = await analytics.getRevenueTrend({
  ...dateRange,
  granularity: 'daily',
});
```

### Sales Funnel

```typescript
const funnel = await analytics.getConversionFunnel(dateRange);

// {
//   steps: [
//     { name: 'Sessions', count: 10000, rate: 100 },
//     { name: 'Product Views', count: 5000, rate: 50 },
//     { name: 'Add to Cart', count: 1500, rate: 15 },
//     { name: 'Checkout Started', count: 800, rate: 8 },
//     { name: 'Purchase', count: 320, rate: 3.2 },
//   ],
//   overallConversion: 3.2,
//   dropoffs: [
//     { from: 'Sessions', to: 'Product Views', dropoff: 50 },
//     { from: 'Add to Cart', to: 'Checkout', dropoff: 46.7 },
//   ]
// }
```

## Customer Analytics

### RFM Analysis

Segment customers by Recency, Frequency, Monetary value:

```typescript
interface RFMSegment {
  segment: string;
  description: string;
  count: number;
  percentage: number;
  avgRevenue: number;
  characteristics: {
    recency: 'high' | 'medium' | 'low';
    frequency: 'high' | 'medium' | 'low';
    monetary: 'high' | 'medium' | 'low';
  };
}

const rfmAnalysis = await analytics.getRFMAnalysis();

// Segments:
// - Champions (R↑ F↑ M↑): Best customers
// - Loyal (R↑ F↑ M-): Frequent buyers
// - Potential Loyalists (R↑ F- M-): Recent, could become loyal
// - At Risk (R↓ F↑ M↑): Were good, haven't bought recently
// - Hibernating (R↓ F↓ M-): Long gone
// - Lost (R↓ F- M-): Lost customers
```

### Customer Lifetime Value (CLV)

```typescript
interface CLVMetrics {
  averageCLV: number;
  clvDistribution: Array<{ range: string; count: number }>;
  topCustomers: Array<{ id: string; clv: number; orders: number }>;
  clvBySegment: Record<string, number>;
  predictedCLV: number;  // ML prediction for next 12 months
}

const clv = await analytics.getCLVAnalysis();

// Individual customer CLV
const customerCLV = await analytics.getCustomerCLV(customerId);
// {
//   totalRevenue: 15000,
//   orderCount: 12,
//   averageOrderValue: 1250,
//   firstPurchase: '2023-06-15',
//   lastPurchase: '2024-01-10',
//   predictedNextPurchase: '2024-02-15',
//   churnRisk: 0.15,
// }
```

### Cohort Analysis

Track customer groups over time:

```typescript
const cohorts = await analytics.getCohortAnalysis({
  cohortType: 'monthly',      // When they first purchased
  metric: 'retention',        // or 'revenue', 'orders'
  periods: 6,                 // Track for 6 periods
});

// Returns retention matrix:
// {
//   cohorts: [
//     { period: '2023-08', size: 500, retention: [100, 45, 32, 28, 25, 22] },
//     { period: '2023-09', size: 600, retention: [100, 48, 35, 30, 27] },
//     ...
//   ]
// }
```

### Customer Segmentation

```typescript
// Behavioral segments
const segments = await analytics.getCustomerSegments();

// {
//   segments: [
//     {
//       name: 'High Spenders',
//       criteria: { avgOrderValue: { gte: 2000 } },
//       count: 250,
//       revenue: 125000,
//     },
//     {
//       name: 'Frequent Buyers',
//       criteria: { orderCount: { gte: 5 }, lastOrder: { within: '30d' } },
//       count: 400,
//       revenue: 80000,
//     },
//     ...
//   ]
// }
```

## Product Analytics

### Product Performance

```typescript
const productPerformance = await analytics.getProductPerformance({
  ...dateRange,
  metrics: ['revenue', 'quantity', 'margin', 'returns', 'views', 'conversion'],
});

// {
//   products: [
//     {
//       id: 'prod_123',
//       name: 'iPhone Case',
//       revenue: 25000,
//       quantity: 500,
//       margin: 0.35,
//       returnRate: 0.02,
//       views: 15000,
//       conversionRate: 0.033,
//     },
//     ...
//   ]
// }
```

### ABC Analysis

Classify products by contribution:

```typescript
const abcAnalysis = await analytics.getABCAnalysis();

// {
//   A: { count: 50, revenue: 70000, percentage: 70 },   // Top 20%
//   B: { count: 100, revenue: 20000, percentage: 20 }, // Middle 30%
//   C: { count: 350, revenue: 10000, percentage: 10 }, // Bottom 50%
// }
```

### Inventory Analytics

```typescript
const inventoryAnalysis = await analytics.getInventoryAnalysis();

// {
//   turnoverRate: 8.5,          // Annual turns
//   daysOfSupply: 43,           // Average DOS
//   stockoutRate: 0.03,         // 3% products out of stock
//   overstockValue: 50000,      // Value of slow-moving stock
//   deadStockValue: 15000,      // No sales in 90+ days
//   recommendations: [
//     { sku: 'SKU001', action: 'reorder', reason: 'Low stock (5 days)' },
//     { sku: 'SKU002', action: 'markdown', reason: 'Dead stock (120 days)' },
//   ]
// }
```

## Traffic Analytics

### Source/Medium Analysis

```typescript
const trafficAnalysis = await analytics.getTrafficAnalysis(dateRange);

// {
//   sessions: 50000,
//   users: 35000,
//   newUsers: 20000,
//   bounceRate: 0.45,
//   avgSessionDuration: 180,    // seconds
//   bySource: [
//     { source: 'google', medium: 'organic', sessions: 20000, conversion: 0.025 },
//     { source: 'facebook', medium: 'cpc', sessions: 8000, conversion: 0.018 },
//     { source: 'direct', medium: 'none', sessions: 12000, conversion: 0.035 },
//   ]
// }
```

### Page Analytics

```typescript
const pageAnalysis = await analytics.getPageAnalysis(dateRange);

// {
//   topPages: [
//     { path: '/', views: 25000, avgTime: 45, bounceRate: 0.30 },
//     { path: '/category/phones', views: 8000, avgTime: 120, bounceRate: 0.25 },
//   ],
//   topLandingPages: [...],
//   topExitPages: [...],
// }
```

## Real-time Analytics

### Live Dashboard

```typescript
// WebSocket subscription
const realtime = analytics.subscribeRealtime();

realtime.on('update', (data) => {
  // {
  //   activeUsers: 125,
  //   ordersToday: 45,
  //   revenueToday: 67500,
  //   recentOrders: [...],
  //   recentEvents: [...],
  // }
});
```

### Live Events

```typescript
// Track live events
analytics.trackEvent({
  type: 'page_view',
  page: '/product/123',
  userId: 'user_abc',
  sessionId: 'sess_xyz',
  timestamp: new Date(),
});

analytics.trackEvent({
  type: 'add_to_cart',
  productId: 'prod_123',
  quantity: 1,
  price: 1500,
});
```

## Reports

### Predefined Reports

| Report | Description | Schedule |
|--------|-------------|----------|
| Daily Sales | Revenue, orders, AOV | Daily 9 AM |
| Weekly Summary | Week-over-week performance | Monday 9 AM |
| Monthly Report | Full monthly analysis | 1st of month |
| Inventory Report | Stock levels, turnover | Weekly |
| Customer Report | Segments, CLV, churn | Monthly |

### Custom Report Builder

```typescript
const customReport = await analytics.buildReport({
  name: 'Category Performance',
  metrics: ['revenue', 'orders', 'margin', 'return_rate'],
  dimensions: ['category', 'brand'],
  filters: [
    { field: 'date', operator: 'between', value: [startDate, endDate] },
    { field: 'category', operator: 'in', value: ['electronics', 'accessories'] },
  ],
  sortBy: { field: 'revenue', direction: 'desc' },
  limit: 50,
});
```

### Export Reports

```typescript
// Export to Excel
const excelBuffer = await analytics.exportReport(reportId, 'xlsx');

// Export to PDF
const pdfBuffer = await analytics.exportReport(reportId, 'pdf');

// Export to CSV
const csvBuffer = await analytics.exportReport(reportId, 'csv');

// Schedule email delivery
await analytics.scheduleReport({
  reportId: reportId,
  schedule: '0 9 * * 1', // Every Monday at 9 AM
  recipients: ['manager@store.com'],
  format: 'xlsx',
});
```

## Alerts & Notifications

### Configure Alerts

```typescript
await analytics.createAlert({
  name: 'Low Conversion Rate',
  condition: {
    metric: 'conversion_rate',
    operator: 'lt',
    threshold: 0.02,
    window: '1h',
  },
  channels: ['email', 'slack'],
  recipients: ['team@store.com'],
});

await analytics.createAlert({
  name: 'Revenue Spike',
  condition: {
    metric: 'revenue',
    operator: 'gt_percent',
    threshold: 50,  // 50% above average
    window: '1h',
  },
  channels: ['slack'],
});
```

### Alert Types

| Alert | Trigger | Action |
|-------|---------|--------|
| Conversion Drop | < 2% for 1 hour | Email + Slack |
| Revenue Spike | > 50% above avg | Slack |
| High Refund Rate | > 5% daily | Email |
| Stockout | Product goes OOS | Email |
| Cart Abandonment | > 80% daily | Daily report |

## API Endpoints

### Analytics API

```
GET /api/v1/analytics/dashboard
GET /api/v1/analytics/sales
GET /api/v1/analytics/customers
GET /api/v1/analytics/products
GET /api/v1/analytics/traffic
GET /api/v1/analytics/funnel
GET /api/v1/analytics/cohorts
GET /api/v1/analytics/rfm
GET /api/v1/analytics/realtime

POST /api/v1/analytics/reports
GET  /api/v1/analytics/reports/:id
GET  /api/v1/analytics/reports/:id/export

POST /api/v1/analytics/alerts
GET  /api/v1/analytics/alerts
```

## Data Pipeline

```
Events ──▶ Kafka/RabbitMQ ──▶ ClickHouse ──▶ Analytics API
   │                              │
   │                              ▼
   └──────────────────────▶ Elasticsearch (Search)
                                  │
                                  ▼
                            Redis (Real-time)
```

## Metrics Glossary

| Metric | Formula | Description |
|--------|---------|-------------|
| AOV | Revenue / Orders | Average Order Value |
| CLV | Avg(Orders) × AOV × Avg(Lifetime) | Customer Lifetime Value |
| Conversion | Orders / Sessions × 100 | Purchase rate |
| Retention | Returning / Total × 100 | Customer return rate |
| Churn | Lost / Total × 100 | Customer loss rate |
| NPS | Promoters - Detractors | Net Promoter Score |
| ARPU | Revenue / Users | Average Revenue Per User |
| CAC | Marketing Cost / New Customers | Customer Acquisition Cost |

## Configuration

```bash
# Analytics database
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=analytics

# Real-time
REDIS_URL=redis://localhost:6379

# Event tracking
EVENTS_KAFKA_BROKERS=localhost:9092
EVENTS_TOPIC=analytics-events

# Reports
REPORTS_S3_BUCKET=analytics-reports
REPORTS_EMAIL_FROM=reports@store.com

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx
ALERT_EMAIL_TO=alerts@store.com
```
