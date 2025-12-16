# AI Forecasting

Система прогнозування попиту та рекомендацій закупівель на основі ML.

## Overview

Модуль AI Forecasting забезпечує:
- Прогнозування попиту
- Рекомендації закупівель
- Оптимізація запасів
- Сезонний аналіз
- Виявлення трендів

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI FORECASTING SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │   Historical │     │   Feature    │     │   ML Models    │  │
│  │   Data       │────▶│   Engineering│────▶│                │  │
│  │              │     │              │     │  - Prophet     │  │
│  │  - Sales     │     │  - Trends    │     │  - XGBoost     │  │
│  │  - Returns   │     │  - Seasons   │     │  - LSTM        │  │
│  │  - Traffic   │     │  - Events    │     │                │  │
│  └──────────────┘     └──────────────┘     └───────┬────────┘  │
│                                                     │           │
│  ┌──────────────┐                                   │           │
│  │   External   │───────────────────────────────────┤           │
│  │   Data       │                                   │           │
│  │              │                                   │           │
│  │  - Weather   │                                   ▼           │
│  │  - Holidays  │                        ┌────────────────┐    │
│  │  - Events    │                        │   Forecasts    │    │
│  └──────────────┘                        │                │    │
│                                          │  - Demand      │    │
│  ┌──────────────┐                        │  - Purchase    │    │
│  │   Actions    │◀───────────────────────│  - Stock       │    │
│  │              │                        │                │    │
│  │  - Alerts    │                        └────────────────┘    │
│  │  - Orders    │                                              │
│  │  - Reports   │                                              │
│  └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Forecast Types

| Type | Horizon | Use Case |
|------|---------|----------|
| `short_term` | 7 days | Operational planning |
| `medium_term` | 30 days | Purchase orders |
| `long_term` | 90+ days | Strategic planning |
| `seasonal` | 365 days | Seasonal patterns |

## Data Models

### Demand Forecast

```typescript
interface DemandForecast {
  productId: string;
  forecastDate: Date;
  generatedAt: Date;
  horizon: 'short_term' | 'medium_term' | 'long_term';
  predictions: DailyPrediction[];
  confidence: number;
  metrics: ForecastMetrics;
}

interface DailyPrediction {
  date: Date;
  predictedDemand: number;
  lowerBound: number;        // 95% CI lower
  upperBound: number;        // 95% CI upper
  factors: DemandFactor[];
}

interface DemandFactor {
  name: string;              // 'seasonality', 'trend', 'promo'
  impact: number;            // Contribution to prediction
}

interface ForecastMetrics {
  mape: number;              // Mean Absolute Percentage Error
  rmse: number;              // Root Mean Square Error
  bias: number;              // Forecast bias
  accuracy: number;          // Overall accuracy %
}
```

### Purchase Recommendation

```typescript
interface PurchaseRecommendation {
  productId: string;
  productName: string;
  sku: string;
  supplier: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  recommendedQty: number;
  leadTimeDays: number;
  estimatedCost: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string[];
}
```

### Inventory Optimization

```typescript
interface InventoryOptimization {
  productId: string;
  currentStock: number;
  optimalStock: number;
  safetyStock: number;
  reorderPoint: number;
  economicOrderQty: number;  // EOQ
  averageDailyDemand: number;
  daysOfStock: number;
  stockoutRisk: number;      // 0-1
  recommendations: string[];
}
```

## Configuration

```bash
# Forecasting settings
FORECAST_ENABLED=true
FORECAST_UPDATE_INTERVAL=24h
FORECAST_MIN_HISTORY_DAYS=90
FORECAST_DEFAULT_HORIZON=30

# Model settings
FORECAST_MODEL=prophet          # prophet, xgboost, lstm
FORECAST_CONFIDENCE_LEVEL=0.95
FORECAST_SEASONALITY_MODE=multiplicative

# External data
FORECAST_WEATHER_ENABLED=true
FORECAST_HOLIDAYS_COUNTRY=UA
```

## Usage

### Generate Forecast

```typescript
import { forecastingService } from '@/lib/ai/forecasting';

// Generate forecast for product
const forecast = await forecastingService.generateForecast({
  productId: 'prod-123',
  horizon: 'medium_term',     // 30 days
  includeFactors: true,
});

console.log('Forecast:', {
  accuracy: forecast.metrics.accuracy,
  predictions: forecast.predictions.slice(0, 7),
});
```

### Get Purchase Recommendations

```typescript
// Get recommendations for all products
const recommendations = await forecastingService.getPurchaseRecommendations({
  warehouseId: 'wh-main',
  urgencyFilter: ['critical', 'high'],
  supplierId: 'supplier-123',
});

for (const rec of recommendations) {
  console.log(`
    ${rec.productName} (${rec.sku})
    Current: ${rec.currentStock}, Recommend: ${rec.recommendedQty}
    Urgency: ${rec.urgency}
    Lead time: ${rec.leadTimeDays} days
    Cost: ${rec.estimatedCost} грн
  `);
}
```

### Create Purchase Order from Recommendations

```typescript
// Convert recommendations to purchase order
const purchaseOrder = await forecastingService.createPurchaseOrder({
  recommendations: recommendationIds,
  supplierId: 'supplier-123',
  expectedDelivery: new Date('2024-02-01'),
});
```

### Optimize Inventory Levels

```typescript
const optimization = await forecastingService.optimizeInventory({
  productId: 'prod-123',
  serviceLevel: 0.95,         // 95% service level
  leadTimeDays: 7,
  orderingCost: 500,          // Cost per order
  holdingCostPercent: 20,     // Annual holding cost %
});

console.log('Optimal Inventory:', {
  safetyStock: optimization.safetyStock,
  reorderPoint: optimization.reorderPoint,
  economicOrderQty: optimization.economicOrderQty,
  daysOfStock: optimization.daysOfStock,
});
```

### Detect Seasonality

```typescript
const seasonality = await forecastingService.analyzeSeasonality({
  productId: 'prod-123',
  periods: ['weekly', 'monthly', 'yearly'],
});

console.log('Seasonal Patterns:', {
  weeklyPattern: seasonality.weekly,    // Day-of-week effects
  monthlyPattern: seasonality.monthly,  // Day-of-month effects
  yearlyPattern: seasonality.yearly,    // Month effects
  peakPeriods: seasonality.peaks,
});
```

## ML Models

### Prophet (Default)

Facebook's Prophet for time series:
- Handles seasonality automatically
- Robust to missing data
- Good for business forecasting

```typescript
const prophetForecast = await forecastingService.forecast({
  model: 'prophet',
  productId: 'prod-123',
  params: {
    yearlySeasonality: true,
    weeklySeasonality: true,
    holidays: ukrainianHolidays,
    changepoints: 25,
  },
});
```

### XGBoost

Gradient boosting for complex patterns:
- Feature-rich predictions
- High accuracy
- Handles many variables

```typescript
const xgbForecast = await forecastingService.forecast({
  model: 'xgboost',
  productId: 'prod-123',
  features: [
    'price', 'promo', 'competitor_price',
    'weather', 'day_of_week', 'is_holiday',
  ],
});
```

### LSTM

Deep learning for sequential patterns:
- Long-term dependencies
- Complex patterns
- Requires more data

```typescript
const lstmForecast = await forecastingService.forecast({
  model: 'lstm',
  productId: 'prod-123',
  params: {
    lookback: 60,
    epochs: 100,
  },
});
```

## API Endpoints

```
GET  /api/v1/forecasting/demand/:productId        # Product forecast
POST /api/v1/forecasting/demand/batch             # Batch forecast

GET  /api/v1/forecasting/recommendations          # Purchase recommendations
POST /api/v1/forecasting/recommendations/order    # Create PO

GET  /api/v1/forecasting/inventory/:productId     # Inventory optimization
POST /api/v1/forecasting/inventory/optimize       # Optimize all

GET  /api/v1/forecasting/seasonality/:productId   # Seasonality analysis
GET  /api/v1/forecasting/trends                   # Trend detection

GET  /api/v1/forecasting/accuracy                 # Model accuracy metrics
POST /api/v1/forecasting/retrain                  # Retrain models
```

### Forecast Response

```json
{
  "productId": "prod-123",
  "generatedAt": "2024-01-15T10:00:00Z",
  "horizon": "medium_term",
  "confidence": 0.87,
  "metrics": {
    "mape": 12.5,
    "accuracy": 87.5
  },
  "predictions": [
    {
      "date": "2024-01-16",
      "predictedDemand": 45,
      "lowerBound": 38,
      "upperBound": 52,
      "factors": [
        {"name": "trend", "impact": 0.15},
        {"name": "weekday", "impact": 0.25},
        {"name": "seasonality", "impact": -0.05}
      ]
    }
  ]
}
```

## Admin UI

Forecasting dashboard at `/admin/analytics/forecasting`:
- Demand charts with forecasts
- Purchase recommendations list
- Inventory optimization suggestions
- Model accuracy metrics
- What-if scenarios

## Alerts

```typescript
// Low stock alert based on forecast
{
  type: 'stockout_risk',
  productId: 'prod-123',
  message: 'Predicted stockout in 5 days',
  currentStock: 15,
  predictedDemand: 25,
  urgency: 'high'
}

// Unusual demand detected
{
  type: 'demand_anomaly',
  productId: 'prod-456',
  message: 'Demand 150% above normal',
  expectedDemand: 20,
  actualDemand: 50
}
```

## Best Practices

1. **Sufficient history** - Need 90+ days of data
2. **Data quality** - Clean outliers and missing data
3. **Regular retraining** - Update models monthly
4. **Monitor accuracy** - Track MAPE and adjust
5. **Safety stock** - Account for uncertainty
6. **Lead times** - Include supplier lead times
7. **External factors** - Consider holidays, promotions

## See Also

- [AI Repricing](./AI_REPRICING.md)
- [Inventory](./INVENTORY.md)
- [Analytics](./ANALYTICS.md)
- [Warehouse](./WAREHOUSE.md)
