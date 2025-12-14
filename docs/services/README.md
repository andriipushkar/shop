# Services Overview

The Shop Platform consists of multiple microservices, each handling a specific domain of functionality.

## Service Map

| Service | Port | Technology | Database | Description |
|---------|------|------------|----------|-------------|
| [Core](./CORE.md) | 8080 | Go | PostgreSQL | Product catalog, inventory, search |
| [OMS](./OMS.md) | 8081 | Go | PostgreSQL | Order management |
| [CRM](./CRM.md) | 8084 | Go | PostgreSQL | Customer management |
| [Notification](./NOTIFICATION.md) | - | Go | - | Email, SMS, push |
| [Telegram Bot](./TELEGRAM_BOT.md) | - | Go | - | Telegram integration |
| [Storefront](./STOREFRONT.md) | 3000 | Next.js | Prisma/PG | Customer web app |
| [Admin](./ADMIN.md) | 3001 | Next.js | Prisma/PG | Back-office app |

## Service Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    Storefront ◄──────────────────────► Admin Panel          │
│        │                                    │                │
│        │         ┌─────────────────┐        │                │
│        └────────►│  Core Service   │◄───────┘                │
│                  │  (Products)     │                         │
│                  └────────┬────────┘                         │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ OMS Service │  │ CRM Service │  │ Telegram    │         │
│  │ (Orders)    │  │ (Customers) │  │ Bot         │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                 │                │
│         └────────────────┼─────────────────┘                │
│                          │                                  │
│                          ▼                                  │
│                  ┌─────────────┐                            │
│                  │Notification │                            │
│                  │  Service    │                            │
│                  └─────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Communication Patterns

### REST API (Synchronous)
- Client to Service communication
- Service to Service for real-time data
- Request/Response pattern

### Message Queue (Asynchronous)
- Event publishing
- Background job processing
- Cross-service notifications

## Health Checks

All services expose health endpoints:

```bash
# Core Service
curl http://localhost:8080/health
curl http://localhost:8080/health/ready
curl http://localhost:8080/health/live

# OMS Service
curl http://localhost:8081/health

# CRM Service
curl http://localhost:8084/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": "24h15m30s",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "rabbitmq": "ok"
  }
}
```

## Metrics

All services expose Prometheus metrics at `/metrics`:

```bash
curl http://localhost:8080/metrics
```

Common metrics:
- `http_requests_total` - Request count by endpoint and status
- `http_request_duration_seconds` - Request latency histogram
- `db_connections_active` - Database connection pool
- `cache_hits_total` / `cache_misses_total` - Cache efficiency

## Service Configuration

Each service is configured via environment variables:

```bash
# Common
ENVIRONMENT=production
LOG_LEVEL=info
PORT=8080

# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h

# Service-specific
# See individual service documentation
```

## Development Guidelines

### Adding a New Service

1. Create service directory under `services/`
2. Set up Go module with standard structure
3. Implement health check endpoints
4. Add Prometheus metrics
5. Configure Docker and docker-compose
6. Add to CI/CD pipeline
7. Document in this directory

### Service Template

```
services/new-service/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── handler/      # HTTP handlers
│   ├── service/      # Business logic
│   ├── repository/   # Data access
│   └── model/        # Data models
├── pkg/              # Shared packages
├── Dockerfile
├── go.mod
└── README.md
```

See individual service documentation for detailed information.
