# Setup Guide

## Prerequisites

- Docker & Docker Compose
- Go 1.23+ (for local development)
- Telegram Bot Token (from @BotFather)

## Quick Start

```bash
# 1. Clone repository
git clone <repo-url>
cd shop

# 2. Set bot token
export TELEGRAM_BOT_TOKEN=your_token_here

# 3. Start all services
docker compose up --build
```

## Access Points

| Service | URL |
|---------|-----|
| Core API | http://localhost:8080 |
| OMS API | http://localhost:8081 |
| RabbitMQ UI | http://localhost:15672 (guest/guest) |
| PostgreSQL | localhost:5433 (user/password) |

## Running Tests

```bash
# Core Service
cd services/core && go test ./... -v

# OMS Service
cd services/oms && GOWORK=off go test ./internal/order/... -v
```

## Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | bot, notification | Telegram Bot API token |
| `DATABASE_URL` | core, oms | PostgreSQL connection string |
| `RABBITMQ_URL` | oms, notification | RabbitMQ connection string |
| `CORE_SERVICE_URL` | bot | URL to Core Service |
| `OMS_SERVICE_URL` | bot | URL to OMS Service |
