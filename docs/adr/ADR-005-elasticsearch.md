# ADR-005: Elasticsearch для пошуку

## Status

Accepted

## Date

2024-01-25

## Context

Потрібна система повнотекстового пошуку для:

- Пошук товарів за назвою та описом
- Фільтрація по атрибутах
- Автодоповнення (suggest)
- Фасетний пошук (faceted search)
- Підтримка української мови

**Вимоги:**
- Швидкий пошук (< 100ms)
- Релевантне ранжування
- Підтримка typo tolerance
- Масштабованість

**Альтернативи:**

1. **PostgreSQL FTS** - вбудований пошук
2. **Elasticsearch** - спеціалізований search engine
3. **Meilisearch** - простіший, швидкий
4. **Algolia** - SaaS рішення
5. **Typesense** - open-source альтернатива Algolia

## Decision

Обрано **Elasticsearch 8.11** для пошуку.

### Обґрунтування

**Search Quality:**
- Потужний query DSL
- BM25 ranking algorithm
- Custom scoring
- Synonyms та stemming

**Performance:**
- Distributed architecture
- Inverted indices
- Caching
- Near real-time search

**Features:**
- Aggregations для фасетів
- Suggesters для автодоповнення
- Highlighting
- Multi-language support

### Index Mapping

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "ukrainian": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "ukrainian_stop", "ukrainian_stemmer"]
        },
        "autocomplete": {
          "type": "custom",
          "tokenizer": "autocomplete",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "autocomplete": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 10
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "ukrainian",
        "fields": {
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete",
            "search_analyzer": "standard"
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "ukrainian"
      },
      "category_id": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "price": { "type": "long" },
      "attributes": { "type": "nested" },
      "created_at": { "type": "date" }
    }
  }
}
```

### Search Query Example

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "телефон samsung",
            "fields": ["name^3", "description", "brand^2"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "is_active": true } },
        { "range": { "price": { "gte": 5000, "lte": 50000 } } }
      ]
    }
  },
  "aggs": {
    "brands": {
      "terms": { "field": "brand", "size": 20 }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 10000 },
          { "from": 10000, "to": 50000 },
          { "from": 50000 }
        ]
      }
    }
  },
  "highlight": {
    "fields": { "name": {}, "description": {} }
  }
}
```

### Sync Strategy

```
┌──────────┐    CDC     ┌──────────┐
│PostgreSQL│ ────────── │ Debezium │
└──────────┘            └────┬─────┘
                             │
                             │ Events
                             ▼
                      ┌──────────────┐
                      │   RabbitMQ   │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  Indexer     │
                      │  Service     │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │Elasticsearch │
                      └──────────────┘
```

## Consequences

### Позитивні

- ✅ **Search Quality**: релевантні результати, fuzzy search
- ✅ **Performance**: швидкий пошук навіть на великих даних
- ✅ **Aggregations**: потужні фасети та аналітика
- ✅ **Scalability**: горизонтальне масштабування
- ✅ **Ecosystem**: Kibana, APM, багато інтеграцій

### Негативні

- ❌ **Complexity**: складний в налаштуванні та підтримці
- ❌ **Resources**: потребує багато RAM та CPU
- ❌ **Consistency**: eventually consistent
- ❌ **Cost**: дорогий в production
- ❌ **Sync lag**: затримка синхронізації з БД

### Mitigation

- Використовувати managed Elasticsearch (AWS OpenSearch)
- Monitoring з Prometheus + Grafana
- Автоматичний reindex при критичних помилках
- Fallback на PostgreSQL FTS якщо ES недоступний

## Related Decisions

- [ADR-004: PostgreSQL як основна БД](./ADR-004-postgresql.md)
- [ADR-006: Event-driven архітектура](./ADR-006-event-driven.md)
