# Recommendations

Система персоналізованих рекомендацій товарів.

## Overview

Модуль recommendations забезпечує:
- Персоналізовані рекомендації
- "Схожі товари"
- "Разом купують"
- "Нещодавно переглянуті"
- "Популярні в категорії"
- ML-based рекомендації

## Recommendation Types

| Type | Algorithm | Description |
|------|-----------|-------------|
| `similar` | Content-based | Схожі за характеристиками |
| `frequently_bought` | Association rules | Часто купують разом |
| `viewed_together` | Session analysis | Переглядають разом |
| `personalized` | Collaborative filtering | Персональні |
| `trending` | Popularity | Популярні зараз |
| `recently_viewed` | Session history | Нещодавно переглянуті |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  RECOMMENDATION ENGINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   User       │  │   Product    │  │   Session            │  │
│  │   Behavior   │  │   Catalog    │  │   Events             │  │
│  │              │  │              │  │                      │  │
│  │  - Views     │  │  - Features  │  │  - Page views        │  │
│  │  - Purchases │  │  - Categories│  │  - Add to cart       │  │
│  │  - Ratings   │  │  - Tags      │  │  - Time on page      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │  ML Pipeline    │                           │
│                  │                 │                           │
│                  │  - Training     │                           │
│                  │  - Inference    │                           │
│                  │  - A/B Testing  │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │  Recommendations │                          │
│                  │  API             │                          │
│                  └─────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Usage

### Get Similar Products

```typescript
import { recommendationsService } from '@/lib/recommendations';

const similar = await recommendationsService.getSimilar({
  productId: 'prod-123',
  limit: 8,
  excludeIds: ['prod-123'],
});
```

### Get Frequently Bought Together

```typescript
const bought = await recommendationsService.getFrequentlyBought({
  productId: 'prod-123',
  limit: 4,
});

// Returns products often bought with this one
// Used on product page: "Разом з цим товаром купують"
```

### Get Personalized Recommendations

```typescript
const personalized = await recommendationsService.getPersonalized({
  userId: user.id,
  limit: 12,
  diversityFactor: 0.3,  // Mix in some diversity
});
```

### Get Trending Products

```typescript
const trending = await recommendationsService.getTrending({
  categoryId: 'electronics',
  period: '7d',
  limit: 10,
});
```

### Track Events

```typescript
// Track product view
await recommendationsService.trackEvent({
  type: 'view',
  userId: user?.id,
  sessionId: session.id,
  productId: 'prod-123',
  context: {
    source: 'category_page',
    position: 5,
  },
});

// Track purchase
await recommendationsService.trackEvent({
  type: 'purchase',
  userId: user.id,
  productId: 'prod-123',
  orderId: order.id,
});
```

## API Endpoints

```
GET /api/v1/recommendations/similar/:productId
GET /api/v1/recommendations/frequently-bought/:productId
GET /api/v1/recommendations/personalized
GET /api/v1/recommendations/trending
GET /api/v1/recommendations/recently-viewed
POST /api/v1/recommendations/events
```

### Response Example

```json
{
  "type": "similar",
  "products": [
    {
      "id": "prod-456",
      "name": "Samsung Galaxy S24",
      "price": 35000,
      "image": "https://cdn.shop.ua/...",
      "score": 0.92
    }
  ],
  "metadata": {
    "algorithm": "content_based_v2",
    "generatedAt": "2024-01-15T10:00:00Z"
  }
}
```

## Configuration

```bash
# Recommendations settings
RECOMMENDATIONS_ENABLED=true
RECOMMENDATIONS_CACHE_TTL=1h
RECOMMENDATIONS_MIN_SCORE=0.5

# ML Model
RECOMMENDATIONS_MODEL=collaborative_filtering
RECOMMENDATIONS_RETRAIN_INTERVAL=24h
```

## Best Practices

1. **Fallback strategy** - Use trending if no personalized
2. **Diversity** - Don't show only similar items
3. **Freshness** - Include new products
4. **A/B testing** - Test algorithm changes
5. **Explainability** - Show why recommended

## See Also

- [Analytics](./ANALYTICS.md)
- [A/B Testing](./AB_TESTING.md)
- [Visual Search](./VISUAL_SEARCH.md)
