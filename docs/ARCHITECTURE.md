# System Architecture

## Overview

Shop Platform is built on a microservices architecture designed for scalability, reliability, and maintainability. The system handles multi-tenant e-commerce operations with support for high traffic loads.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Browser    │  │  Mobile App  │  │ Telegram Bot │  │  External Systems    │ │
│  │  (Next.js)   │  │   (Future)   │  │              │  │  (Marketplaces)      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY / LOAD BALANCER                         │
│                         (Nginx / AWS ALB / Kubernetes Ingress)                   │
│                    Rate Limiting │ SSL Termination │ Routing                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
           ┌─────────────────────────────┼─────────────────────────────┐
           │                             │                             │
           ▼                             ▼                             ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   STOREFRONT     │        │   ADMIN PANEL    │        │   API SERVICES   │
│    (Next.js)     │        │    (Next.js)     │        │                  │
│    Port: 3000    │        │    Port: 3001    │        │                  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
           │                             │                             │
           └─────────────────────────────┼─────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MICROSERVICES LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  CORE SERVICE   │  │   OMS SERVICE   │  │   CRM SERVICE   │                  │
│  │   Port: 8080    │  │   Port: 8081    │  │   Port: 8084    │                  │
│  │                 │  │                 │  │                 │                  │
│  │ - Products      │  │ - Orders        │  │ - Customers     │                  │
│  │ - Categories    │  │ - Payments      │  │ - Segments      │                  │
│  │ - Inventory     │  │ - Shipments     │  │ - Analytics     │                  │
│  │ - Search        │  │ - Promo codes   │  │ - Loyalty       │                  │
│  │ - Warehouse     │  │ - Refunds       │  │                 │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                    │                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  NOTIFICATION   │  │  TELEGRAM BOT   │  │   SCHEDULER     │                  │
│  │    SERVICE      │  │    SERVICE      │  │   (Internal)    │                  │
│  │                 │  │                 │  │                 │                  │
│  │ - Email         │  │ - Commands      │  │ - Cron jobs     │                  │
│  │ - SMS           │  │ - Orders        │  │ - Sync tasks    │                  │
│  │ - Push          │  │ - Notifications │  │ - Reports       │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MESSAGE BROKER                                      │
│                              (RabbitMQ)                                          │
│                                                                                  │
│  Exchanges: orders, products, notifications, analytics                           │
│  Queues: order.created, product.updated, stock.alert, etc.                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   PostgreSQL    │  │     Redis       │  │  Elasticsearch  │                  │
│  │   Port: 5433    │  │   Port: 6379    │  │   Port: 9200    │                  │
│  │                 │  │                 │  │                 │                  │
│  │ - Products      │  │ - Sessions      │  │ - Product index │                  │
│  │ - Orders        │  │ - Cache         │  │ - Search        │                  │
│  │ - Customers     │  │ - Rate limits   │  │ - Autocomplete  │                  │
│  │ - Inventory     │  │ - Pub/Sub       │  │ - Analytics     │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
│  ┌─────────────────┐                                                            │
│  │  MinIO (S3)     │                                                            │
│  │   Port: 9000    │                                                            │
│  │                 │                                                            │
│  │ - Images        │                                                            │
│  │ - Documents     │                                                            │
│  │ - Exports       │                                                            │
│  └─────────────────┘                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            OBSERVABILITY                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Prometheus    │  │     Grafana     │  │     Jaeger      │                  │
│  │   Port: 9090    │  │   Port: 3001    │  │   Port: 16686   │                  │
│  │                 │  │                 │  │                 │                  │
│  │ - Metrics       │  │ - Dashboards    │  │ - Traces        │                  │
│  │ - Alerts        │  │ - Visualization │  │ - Performance   │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Microservices Architecture
Each service is:
- **Independent**: Can be developed, deployed, and scaled independently
- **Single Responsibility**: Handles one domain (products, orders, customers)
- **Loosely Coupled**: Communicates via APIs and message queues
- **Database per Service**: Each service manages its own data

### 2. Event-Driven Communication
- **Asynchronous**: Non-blocking operations via RabbitMQ
- **Event Sourcing Ready**: All state changes emit events
- **Eventual Consistency**: Services sync via events
- **Retry Mechanisms**: Failed messages are retried with backoff

### 3. Multi-Tenancy
- **Tenant Isolation**: Data separated by tenant_id
- **Shared Infrastructure**: Single deployment serves multiple tenants
- **Per-Tenant Configuration**: Custom settings per store
- **Resource Quotas**: Limits per tenant plan

### 4. Caching Strategy
```
┌─────────────────────────────────────────────────┐
│                  Request Flow                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Request ──▶ CDN Cache ──▶ API Gateway          │
│                              │                   │
│                              ▼                   │
│                         Redis Cache              │
│                         (Hit? Return)            │
│                              │                   │
│                              ▼ (Miss)            │
│                         Database                 │
│                              │                   │
│                              ▼                   │
│                    Update Redis Cache            │
│                              │                   │
│                              ▼                   │
│                         Response                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Cache Layers**:
1. **CDN** (CloudFront): Static assets, images
2. **Redis L1**: Hot data (products, categories, sessions)
3. **Application**: In-memory for frequent lookups

**Cache Invalidation**:
- TTL-based expiration
- Event-driven invalidation on updates
- Cache-aside pattern

### 5. Search Architecture
```
┌─────────────────────────────────────────────────┐
│              Search Pipeline                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Product Update ──▶ RabbitMQ ──▶ Indexer        │
│                                      │           │
│                                      ▼           │
│                              Elasticsearch       │
│                                      │           │
│                                      ▼           │
│  Search Query ──▶ Elasticsearch ──▶ Results     │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Features**:
- Full-text search with Ukrainian/Russian stemming
- Faceted filtering (categories, brands, price ranges)
- Autocomplete with fuzzy matching
- Synonyms support
- Personalized ranking

## Service Communication

### Synchronous (REST/gRPC)
```
Storefront ──HTTP──▶ Core Service ──▶ Response
```

Used for:
- User-facing API requests
- Real-time data requirements
- CRUD operations

### Asynchronous (RabbitMQ)
```
OMS ──publish──▶ RabbitMQ ──consume──▶ Notification
                           ──consume──▶ Analytics
                           ──consume──▶ CRM
```

Used for:
- Background processing
- Event notifications
- Cross-service data sync
- Bulk operations

## Data Flow Examples

### Order Creation Flow
```
1. Customer submits order (Storefront)
           │
           ▼
2. Core Service validates products/stock
           │
           ▼
3. OMS Service creates order
           │
           ├──▶ Publishes "order.created" event
           │
           ▼
4. Payment Service processes payment
           │
           ├──▶ Publishes "payment.completed" event
           │
           ▼
5. Notification Service sends confirmation
           │
           ▼
6. CRM Service updates customer history
           │
           ▼
7. Warehouse receives order for fulfillment
```

### Product Search Flow
```
1. User types search query
           │
           ▼
2. Storefront sends request to Core API
           │
           ▼
3. Core checks Redis cache
           │
           ├──▶ Cache Hit: Return results
           │
           ▼ Cache Miss
4. Query Elasticsearch
           │
           ▼
5. Apply business rules (stock, visibility)
           │
           ▼
6. Cache results in Redis
           │
           ▼
7. Return to user
```

## Scalability

### Horizontal Scaling
```
                    Load Balancer
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ Core-1  │     │ Core-2  │     │ Core-3  │
    └─────────┘     └─────────┘     └─────────┘
```

- Stateless services scale horizontally
- Database read replicas for read scaling
- Redis Cluster for cache scaling
- Elasticsearch cluster for search scaling

### Database Scaling
- **Read Replicas**: PostgreSQL streaming replication
- **Connection Pooling**: PgBouncer
- **Partitioning**: By tenant_id for large tables
- **Archival**: Old orders moved to archive tables

## Security Architecture

```
┌─────────────────────────────────────────────────┐
│                Security Layers                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. WAF (Web Application Firewall)              │
│     └── DDoS protection, SQL injection          │
│                                                  │
│  2. SSL/TLS Termination                         │
│     └── HTTPS everywhere                        │
│                                                  │
│  3. API Gateway                                 │
│     └── Rate limiting, API keys                 │
│                                                  │
│  4. Authentication                              │
│     └── JWT tokens, OAuth2                      │
│                                                  │
│  5. Authorization                               │
│     └── RBAC, tenant isolation                  │
│                                                  │
│  6. Data Encryption                             │
│     └── At rest (AES-256), in transit (TLS)    │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Disaster Recovery

- **RPO** (Recovery Point Objective): 1 hour
- **RTO** (Recovery Time Objective): 15 minutes

**Strategies**:
1. Database: Daily backups + point-in-time recovery
2. Cross-region replication for production
3. Infrastructure as Code for quick rebuilds
4. Runbook documentation for all scenarios

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Go | Performance, concurrency, simplicity |
| Database | PostgreSQL | ACID, JSON support, mature ecosystem |
| Cache | Redis | Speed, pub/sub, data structures |
| Search | Elasticsearch | Full-text, facets, scalability |
| Queue | RabbitMQ | Reliability, routing, management UI |
| Frontend | Next.js | SSR, React ecosystem, performance |
| Container | Docker | Portability, consistency |
| Orchestration | Kubernetes | Auto-scaling, self-healing |

See [Services Documentation](./services/README.md) for detailed service descriptions.
