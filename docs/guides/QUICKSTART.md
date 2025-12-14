# Quick Start Guide

Get the Shop Platform running locally in under 10 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Docker** 24.0+ and **Docker Compose** 2.20+
- **Go** 1.24+ (for backend development)
- **Node.js** 20+ and **npm** 10+ (for frontend development)
- **Git**

## 1. Clone the Repository

```bash
git clone https://github.com/your-org/shop.git
cd shop
```

## 2. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, RabbitMQ, Elasticsearch
docker-compose up -d postgres redis rabbitmq elasticsearch
```

Wait for services to be ready (~30 seconds):
```bash
docker-compose ps
```

## 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings (optional for local development)
# Default values work out of the box
```

## 4. Start Backend Services

### Option A: Using Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option B: Running Locally

```bash
# Terminal 1 - Core Service
cd services/core
go run cmd/server/main.go

# Terminal 2 - OMS Service
cd services/oms
go run cmd/server/main.go

# Terminal 3 - CRM Service
cd services/crm
go run cmd/server/main.go
```

## 5. Start Frontend

```bash
# Terminal - Storefront
cd services/storefront
npm install
npm run dev
```

## 6. Access the Application

| Application | URL | Description |
|-------------|-----|-------------|
| Storefront | http://localhost:3000 | Customer-facing store |
| Admin Panel | http://localhost:3000/admin | Back-office |
| Core API | http://localhost:8080 | Product API |
| OMS API | http://localhost:8081 | Orders API |
| CRM API | http://localhost:8084 | Customers API |
| RabbitMQ UI | http://localhost:15672 | Message broker (guest/guest) |
| Grafana | http://localhost:3001 | Monitoring dashboards |
| Jaeger | http://localhost:16686 | Distributed tracing |

## 7. Create Test Data

```bash
# Seed database with sample products and categories
cd services/core
go run cmd/seed/main.go

# Or via API
curl -X POST http://localhost:8080/api/v1/seed
```

## 8. Verify Installation

```bash
# Check API health
curl http://localhost:8080/health

# Get products
curl http://localhost:8080/api/v1/products

# Check services status
docker-compose ps
```

## Common Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Restart a service
docker-compose restart core

# Rebuild after code changes
docker-compose up -d --build

# Run tests
make test

# Run specific service tests
make test-core
make test-oms
```

## Project Structure

```
shop/
├── services/
│   ├── core/           # Product catalog, inventory
│   ├── oms/            # Order management
│   ├── crm/            # Customer management
│   ├── notification/   # Notifications
│   ├── telegram-bot/   # Telegram integration
│   ├── storefront/     # Next.js customer app
│   └── admin/          # Next.js admin app
├── infrastructure/
│   ├── docker/         # Dockerfiles
│   ├── terraform/      # IaC for cloud
│   └── k8s/            # Kubernetes manifests
├── docs/               # Documentation
└── docker-compose.yml  # Local development
```

## Next Steps

1. [Configure payment providers](../modules/PAYMENTS.md)
2. [Set up delivery integrations](../modules/DELIVERY.md)
3. [Connect marketplace accounts](../modules/MARKETPLACES.md)
4. [Configure email/SMS notifications](../services/NOTIFICATION.md)
5. [Deploy to production](../deployment/README.md)

## Troubleshooting

### Port already in use
```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Database connection failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres
```

### Elasticsearch not starting
```bash
# Increase virtual memory (Linux)
sudo sysctl -w vm.max_map_count=262144

# Restart Elasticsearch
docker-compose restart elasticsearch
```

### Services can't connect
```bash
# Ensure all services are on the same network
docker network ls
docker-compose up -d
```

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for more solutions.
