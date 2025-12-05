# Microservices Shop

A microservices-based e-commerce system with Telegram Bot interface.

## Quick Start

```bash
export TELEGRAM_BOT_TOKEN=your_token
docker compose up --build
```

## Documentation

- [Architecture](docs/architecture.md) - System design and data flow
- [API Reference](docs/api.md) - HTTP endpoints and bot commands
- [Setup Guide](docs/setup.md) - Installation and configuration

## Services

| Service | Description |
|---------|-------------|
| Core | Product management (PIM) |
| OMS | Order management |
| Bot | Telegram interface |
| Notification | Order confirmations |

## Tech Stack

- **Go** - Backend services
- **PostgreSQL** - Database
- **RabbitMQ** - Event bus
- **Docker** - Containerization
