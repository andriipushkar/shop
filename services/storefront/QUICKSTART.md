# Quick Start Guide

Get the TechShop Storefront up and running in minutes with Docker.

## Prerequisites

- Docker 24.0+ and Docker Compose 2.20+
- Make (optional, but recommended)

## 5-Minute Setup

### Option 1: Using Make (Recommended)

```bash
# 1. Setup environment
cp .env.docker .env

# 2. Start everything
make docker-dev-tools

# 3. Run migrations and seed
make db-migrate
make db-seed

# 4. Done! Access the application:
# - Storefront: http://localhost:3000
# - Adminer: http://localhost:8080
# - Redis Commander: http://localhost:8081
```

### Option 2: Using Docker Compose

```bash
# 1. Setup environment
cp .env.docker .env

# 2. Start services
docker-compose --profile tools up -d

# 3. Run migrations
docker-compose exec storefront npx prisma migrate dev
docker-compose exec storefront npx prisma db seed

# 4. View logs
docker-compose logs -f storefront
```

## Common Commands

### Using Make

```bash
make help              # Show all available commands
make docker-dev        # Start development environment
make docker-stop       # Stop all services
make docker-logs       # View logs
make db-migrate        # Run database migrations
make test              # Run tests
make lint              # Run linter
```

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Run commands in container
docker-compose exec storefront npm run <command>
```

## Verify Installation

```bash
# Check service health
make health
# or
docker-compose ps

# Test the health endpoint
curl http://localhost:3000/api/health
```

## Default Credentials

### Database (Adminer)
- **System**: PostgreSQL
- **Server**: db
- **Username**: postgres
- **Password**: postgres
- **Database**: storefront

### Redis Commander
- **Username**: admin
- **Password**: admin

## Troubleshooting

### Port Already in Use

If port 3000, 5432, or 6379 is already in use:

```bash
# Edit .env and change ports
POSTGRES_PORT=5433
REDIS_PORT=6380

# Or edit docker-compose.yml
```

### Database Connection Error

```bash
# Restart database
docker-compose restart db

# Check database logs
docker-compose logs db

# Reset database
make db-reset
```

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Rebuild containers
make docker-rebuild

# Clean and restart
make docker-clean
make docker-dev
```

## Next Steps

1. **Read the full documentation**: [README-DOCKER.md](./README-DOCKER.md)
2. **Set up CI/CD secrets** in GitHub repository settings
3. **Configure environment variables** for production
4. **Review security settings** before deploying

## Getting Help

- Check [README-DOCKER.md](./README-DOCKER.md) for detailed documentation
- Run `make help` to see all available commands
- View logs with `docker-compose logs -f`
- Check service status with `docker-compose ps`

## Production Deployment

For production deployment:

```bash
# Build production image
make docker-build-prod

# Start production stack
make docker-prod

# Or with nginx
make docker-prod-full
```

See [README-DOCKER.md](./README-DOCKER.md) for complete production deployment guide.
