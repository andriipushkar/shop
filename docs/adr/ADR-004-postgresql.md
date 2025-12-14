# ADR-004: PostgreSQL як основна БД

## Status

Accepted

## Date

2024-01-20

## Context

Потрібно обрати основну базу даних для зберігання бізнес-даних:

- Товари, категорії, атрибути
- Замовлення, платежі
- Клієнти, адреси
- Інвентаризація

**Вимоги:**
- ACID транзакції
- Складні запити (JOIN, aggregations)
- JSON підтримка для гнучких схем
- Масштабування для високого навантаження
- Надійність та data integrity

**Альтернативи:**

1. **PostgreSQL** - потужна реляційна БД
2. **MySQL** - популярна реляційна БД
3. **MongoDB** - документна БД
4. **CockroachDB** - distributed SQL
5. **Vitess** - MySQL sharding solution

## Decision

Обрано **PostgreSQL 15** як основну базу даних.

### Обґрунтування

**Data Integrity:**
- Повна підтримка ACID
- Foreign keys та constraints
- Сильна типізація

**Features:**
- JSONB для напівструктурованих даних
- Full-text search
- Partitioning для великих таблиць
- Materialized views

**Performance:**
- Ефективні індекси (B-tree, GIN, GiST)
- Query planner оптимізації
- Parallel queries
- Connection pooling (PgBouncer)

**Ecosystem:**
- Відмінна підтримка в Go (pgx, GORM)
- Managed solutions (AWS RDS, Cloud SQL)
- Багато extensions

### Schema Design

```sql
-- Products з JSONB для атрибутів
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial index для active products
CREATE INDEX idx_products_active ON products(category_id)
    WHERE is_active = true;

-- GIN index для JSONB
CREATE INDEX idx_products_attributes ON products
    USING GIN (attributes);

-- Partitioning для orders
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    -- ...
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_q1 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
```

### Replication

```
┌─────────────┐
│   Primary   │
│  (Read/Write)│
└──────┬──────┘
       │
       │ Streaming Replication
       │
┌──────┼──────┐
│      │      │
▼      ▼      ▼
┌────┐ ┌────┐ ┌────┐
│Rep1│ │Rep2│ │Rep3│
│Read│ │Read│ │Read│
└────┘ └────┘ └────┘
```

## Consequences

### Позитивні

- ✅ **Reliability**: ACID, proven technology
- ✅ **Features**: JSONB, FTS, partitioning
- ✅ **Performance**: ефективні індекси та оптимізатор
- ✅ **Ecosystem**: extensions, tools, managed services
- ✅ **Community**: активна спільнота, документація

### Негативні

- ❌ **Horizontal scaling**: складніше ніж NoSQL
- ❌ **Schema changes**: міграції можуть бути складними
- ❌ **Write scaling**: single primary bottleneck
- ❌ **Operational complexity**: налаштування реплікації

### Configuration

```ini
# postgresql.conf для production
shared_buffers = 4GB           # 25% RAM
effective_cache_size = 12GB    # 75% RAM
work_mem = 64MB
maintenance_work_mem = 1GB

# WAL
wal_buffers = 64MB
max_wal_size = 4GB

# Query planning
random_page_cost = 1.1         # SSD
effective_io_concurrency = 200

# Parallelism
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

## Related Decisions

- [ADR-002: Go як мова бекенду](./ADR-002-go-backend.md)
- [ADR-005: Elasticsearch для пошуку](./ADR-005-elasticsearch.md)
