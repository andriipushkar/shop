# AI Repricing

Система автоматичного коригування цін на основі конкурентного аналізу та AI.

## Overview

Модуль AI Repricing забезпечує:
- Моніторинг цін конкурентів
- Автоматичне коригування цін
- Правила ціноутворення
- ML-моделі для оптимальних цін
- Аналіз маржинальності

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI REPRICING SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │  Competitor  │     │   Price      │     │   ML Model     │  │
│  │  Scraper     │────▶│   Analyzer   │────▶│   (Optimizer)  │  │
│  │              │     │              │     │                │  │
│  │  - Rozetka   │     │  - Compare   │     │  - Demand      │  │
│  │  - Prom.ua   │     │  - History   │     │  - Elasticity  │  │
│  │  - Hotline   │     │  - Trends    │     │  - Margin      │  │
│  └──────────────┘     └──────────────┘     └───────┬────────┘  │
│                                                     │           │
│                                                     ▼           │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │   Pricing    │◀────│   Rules      │◀────│   Recommended  │  │
│  │   Engine     │     │   Engine     │     │   Prices       │  │
│  │              │     │              │     │                │  │
│  │  - Apply     │     │  - Min/Max   │     │  - Optimal     │  │
│  │  - Schedule  │     │  - Margin    │     │  - Competitive │  │
│  │  - Rollback  │     │  - Rounding  │     │  - Profit max  │  │
│  └──────────────┘     └──────────────┘     └────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Repricing Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `match_lowest` | Рівень з найнижчою ціною | Агресивна конкуренція |
| `beat_lowest` | Нижче найнижчої на X% | Лідерство по ціні |
| `match_average` | Середня ціна ринку | Збалансована |
| `premium` | Вище середньої на X% | Преміум позиціонування |
| `margin_target` | Фіксована маржа | Контроль прибутку |
| `ai_optimal` | AI оптимізація | Максимум прибутку |

## Data Models

### Competitor Price

```typescript
interface CompetitorPrice {
  id: string;
  productId: string;
  sku: string;
  competitor: string;          // 'rozetka', 'prom', 'hotline'
  competitorProductUrl: string;
  price: number;
  oldPrice?: number;
  inStock: boolean;
  lastChecked: Date;
  priceHistory: PricePoint[];
}

interface PricePoint {
  price: number;
  date: Date;
}
```

### Pricing Rule

```typescript
interface PricingRule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  strategy: RepricingStrategy;
  settings: StrategySettings;
  schedule?: Schedule;
  isActive: boolean;
}

interface RuleCondition {
  field: 'category' | 'brand' | 'tag' | 'margin' | 'stock';
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}

interface StrategySettings {
  targetMargin?: number;       // For margin_target
  beatBy?: number;             // % to beat competitor
  premiumPercent?: number;     // % above average
  minPrice?: number;
  maxPrice?: number;
  roundTo?: number;            // Round to .99, .00
}
```

### Price Recommendation

```typescript
interface PriceRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  competitorLowest: number;
  competitorAverage: number;
  margin: number;
  confidence: number;          // 0-1
  reasoning: string[];
  appliedRule?: string;
}
```

## Configuration

```bash
# Competitor monitoring
REPRICING_ENABLED=true
REPRICING_CHECK_INTERVAL=6h
REPRICING_COMPETITORS=rozetka,prom,hotline

# Pricing constraints
REPRICING_MIN_MARGIN=5         # Minimum 5% margin
REPRICING_MAX_DECREASE=15      # Max 15% price decrease
REPRICING_MAX_INCREASE=10      # Max 10% price increase

# AI settings
REPRICING_AI_ENABLED=true
REPRICING_AI_MODEL=price_optimizer_v2
```

## Usage

### Set Up Competitor Monitoring

```typescript
import { repricingService } from '@/lib/ai/repricing';

// Add competitor product mapping
await repricingService.mapCompetitorProduct({
  productId: 'prod-123',
  competitor: 'rozetka',
  competitorUrl: 'https://rozetka.com.ua/123456/',
  competitorSku: 'RZ-123456',
});

// Fetch competitor prices
await repricingService.fetchCompetitorPrices('prod-123');
```

### Create Pricing Rule

```typescript
// Rule: Beat lowest price by 2% for electronics
const rule = await repricingService.createRule({
  name: 'Beat Electronics',
  priority: 1,
  conditions: [
    { field: 'category', operator: 'eq', value: 'electronics' },
  ],
  strategy: 'beat_lowest',
  settings: {
    beatBy: 2,
    minPrice: 100,
    roundTo: 99,
  },
  isActive: true,
});

// Rule: Maintain 20% margin for accessories
const marginRule = await repricingService.createRule({
  name: 'Accessories Margin',
  priority: 2,
  conditions: [
    { field: 'category', operator: 'eq', value: 'accessories' },
  ],
  strategy: 'margin_target',
  settings: {
    targetMargin: 20,
    maxPrice: 5000,
  },
  isActive: true,
});
```

### Get Price Recommendations

```typescript
// Get recommendations for all products
const recommendations = await repricingService.getRecommendations({
  categoryId: 'electronics',
  minConfidence: 0.7,
});

for (const rec of recommendations) {
  console.log(`
    Product: ${rec.productId}
    Current: ${rec.currentPrice} грн
    Recommended: ${rec.recommendedPrice} грн
    Margin: ${rec.margin}%
    Confidence: ${rec.confidence * 100}%
    Reason: ${rec.reasoning.join(', ')}
  `);
}
```

### Apply Price Changes

```typescript
// Apply single recommendation
await repricingService.applyRecommendation(recommendationId, {
  reason: 'Competitor price drop',
  approvedBy: user.id,
});

// Bulk apply
await repricingService.bulkApply({
  recommendations: recommendationIds,
  reason: 'Weekly repricing',
  approvedBy: user.id,
});

// Auto-apply (with rules)
await repricingService.autoApply({
  maxChanges: 100,
  minConfidence: 0.9,
  requireApproval: false,
});
```

### Rollback Price Changes

```typescript
// Rollback single change
await repricingService.rollback(priceChangeId);

// Rollback batch
await repricingService.rollbackBatch(batchId);
```

## AI Price Optimization

### Model Input Features

| Feature | Description |
|---------|-------------|
| `competitor_prices` | Array of competitor prices |
| `price_history` | Historical prices |
| `sales_velocity` | Sales per day |
| `stock_level` | Current inventory |
| `demand_trend` | Increasing/decreasing |
| `seasonality` | Seasonal factors |
| `cost` | Product cost |
| `category_avg` | Category average price |

### Model Output

```typescript
interface AIOptimizationResult {
  optimalPrice: number;
  expectedRevenue: number;
  expectedMargin: number;
  demandElasticity: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  factors: {
    factor: string;
    impact: number;  // -1 to 1
    description: string;
  }[];
}
```

## API Endpoints

```
GET  /api/v1/repricing/competitors/:productId     # Competitor prices
POST /api/v1/repricing/competitors/fetch          # Fetch new prices

GET  /api/v1/repricing/rules                      # List rules
POST /api/v1/repricing/rules                      # Create rule
PUT  /api/v1/repricing/rules/:id                  # Update rule
DELETE /api/v1/repricing/rules/:id                # Delete rule

GET  /api/v1/repricing/recommendations            # Get recommendations
POST /api/v1/repricing/recommendations/apply      # Apply changes
POST /api/v1/repricing/recommendations/bulk-apply # Bulk apply

GET  /api/v1/repricing/history                    # Price change history
POST /api/v1/repricing/rollback/:id               # Rollback change

GET  /api/v1/repricing/analytics                  # Repricing analytics
```

## Admin UI

Repricing dashboard at `/admin/pricing/repricing`:
- Competitor price comparison
- Price recommendations with approval workflow
- Rule builder
- Price change history
- Analytics and reports

## Events

| Event | Description |
|-------|-------------|
| `competitor.price_changed` | Competitor price updated |
| `repricing.recommendation_created` | New recommendation |
| `repricing.price_applied` | Price change applied |
| `repricing.price_rolled_back` | Price reverted |

## Best Practices

1. **Start conservative** - Begin with small adjustments
2. **Monitor margins** - Set minimum margin constraints
3. **Test rules** - Test before enabling auto-apply
4. **Review regularly** - Check recommendations daily
5. **Track performance** - Monitor sales after changes
6. **Seasonal adjustments** - Account for seasonality
7. **Competitor validation** - Verify competitor data accuracy

## See Also

- [AI Forecasting](./AI_FORECASTING.md)
- [Pricing](./PRICING.md)
- [Analytics](./ANALYTICS.md)
- [Marketplaces](./MARKETPLACES.md)
