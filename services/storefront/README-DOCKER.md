# Docker & CI/CD Documentation

Complete guide for running the TechShop Storefront with Docker and understanding the CI/CD pipeline.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Setup](#docker-setup)
- [Development with Docker](#development-with-docker)
- [Production Deployment](#production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker 24.0+ and Docker Compose 2.20+
- Node.js 20+ (for local development without Docker)
- Git

### Start Development Environment

```bash
# 1. Clone the repository
git clone <repository-url>
cd services/storefront

# 2. Copy environment file
cp .env.docker .env

# 3. Start all services
docker-compose up -d

# 4. View logs
docker-compose logs -f storefront

# 5. Access the application
# - Storefront: http://localhost:3000
# - Adminer (DB): http://localhost:8080
# - Redis Commander: http://localhost:8081
```

## Docker Setup

### Available Services

The `docker-compose.yml` defines the following services:

#### Core Services
- **storefront** - Next.js application (development mode)
- **db** - PostgreSQL 16 database
- **redis** - Redis 7 cache/session store

#### Production Services (use `--profile production`)
- **storefront-prod** - Next.js application (production mode)
- **nginx** - Reverse proxy with SSL support

#### Development Tools (use `--profile tools`)
- **adminer** - Database management UI
- **redis-commander** - Redis management UI

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Storefront (dev) | 3000 | http://localhost:3000 |
| Storefront (prod) | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Adminer | 8080 | http://localhost:8080 |
| Redis Commander | 8081 | http://localhost:8081 |
| Nginx | 80, 443 | http://localhost |

## Development with Docker

### Starting Services

```bash
# Start all development services
docker-compose up -d

# Start with management tools
docker-compose --profile tools up -d

# Start specific services
docker-compose up -d db redis storefront

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f storefront
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Stop but keep containers
docker-compose stop
```

### Rebuilding Images

```bash
# Rebuild all images
docker-compose build

# Rebuild specific service
docker-compose build storefront

# Rebuild without cache
docker-compose build --no-cache

# Rebuild and restart
docker-compose up -d --build
```

### Database Management

```bash
# Run Prisma migrations
docker-compose exec storefront npx prisma migrate dev

# Open Prisma Studio
docker-compose exec storefront npx prisma studio

# Seed the database
docker-compose exec storefront npx prisma db seed

# Reset database
docker-compose exec storefront npx prisma migrate reset

# Access PostgreSQL directly
docker-compose exec db psql -U postgres -d storefront
```

### Redis Management

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli monitor

# Check Redis info
docker-compose exec redis redis-cli info

# Flush all data (WARNING: deletes all cache)
docker-compose exec redis redis-cli flushall
```

### Running Commands in Container

```bash
# Install new package
docker-compose exec storefront npm install <package-name>

# Run tests
docker-compose exec storefront npm test

# Run linter
docker-compose exec storefront npm run lint

# Type check
docker-compose exec storefront npm run type-check

# Access container shell
docker-compose exec storefront sh
```

## Production Deployment

### Local Production Testing

```bash
# Build and start production services
docker-compose --profile production up -d

# View production logs
docker-compose logs -f storefront-prod nginx

# Access production build
# http://localhost:3001 (direct)
# http://localhost (via nginx)
```

### Building Production Image

```bash
# Build production image
docker build -t storefront:latest --target runner .

# Run production container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e REDIS_URL="redis://host:6379" \
  -e NEXTAUTH_URL="https://yourdomain.com" \
  -e NEXTAUTH_SECRET="your-secret-key" \
  storefront:latest
```

### Environment Variables

Required environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<random-32-char-string>

# Site
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_NAME=TechShop
```

### Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Inspect specific service
docker inspect <container-id> | jq '.[0].State.Health'

# Manual health check
curl http://localhost:3000/api/health
```

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push to `main`/`develop` and pull requests:

**Jobs:**
- **Lint & Type Check** - ESLint and TypeScript validation
- **Unit Tests** - Jest tests with coverage
- **Build** - Next.js production build
- **Docker Build & Push** - Builds and pushes to GitHub Container Registry
- **Security Scan** - npm audit and Snyk scanning
- **Lighthouse Audit** - Performance testing (PRs only)
- **Deploy to Vercel** - Optional deployment (main branch only)

**Required Secrets:**
- `CODECOV_TOKEN` - For test coverage reports
- `SNYK_TOKEN` - For security scanning
- `VERCEL_TOKEN` - For Vercel deployment (optional)
- `VERCEL_ORG_ID` - Vercel organization ID (optional)
- `VERCEL_PROJECT_ID` - Vercel project ID (optional)

#### 2. E2E Tests (`.github/workflows/e2e.yml`)

Runs on push, pull requests, and nightly:

**Jobs:**
- **E2E Tests** - Playwright tests across browsers (Chromium, Firefox, WebKit)
- **Visual Regression** - Screenshot comparison tests (PRs only)
- **Results Summary** - Aggregates and reports results

**Features:**
- Parallel test execution with sharding
- Full PostgreSQL and Redis services
- Test artifacts and reports
- PR comments with results

### Caching Strategy

The CI pipeline implements aggressive caching:

1. **npm dependencies** - Cached by `package-lock.json` hash
2. **Next.js build cache** - Speeds up subsequent builds
3. **Docker layers** - GitHub Actions cache for Docker builds
4. **Playwright browsers** - Cached between E2E runs

### Manual Workflow Triggers

```bash
# Trigger workflows manually via GitHub UI or CLI
gh workflow run ci.yml
gh workflow run e2e.yml
```

### Viewing CI Results

```bash
# View workflow runs
gh run list

# View specific run
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port in docker-compose.yml
ports:
  - "3001:3000"
```

#### Database Connection Failed

```bash
# Check database is running
docker-compose ps db

# View database logs
docker-compose logs db

# Verify connection string
docker-compose exec storefront env | grep DATABASE_URL

# Recreate database
docker-compose down -v
docker-compose up -d db
```

#### Out of Memory

```bash
# Check Docker resource limits
docker stats

# Increase Docker memory (Docker Desktop settings)
# Or reduce service memory in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
```

#### Permission Issues

```bash
# Fix ownership (Linux)
sudo chown -R $USER:$USER .

# Reset Docker volumes
docker-compose down -v
docker-compose up -d
```

#### Hot Reload Not Working

```bash
# Ensure volumes are mounted correctly
docker-compose down
docker-compose up -d

# Check file watching limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Debug Mode

```bash
# Run with verbose logging
docker-compose --verbose up

# Enable Next.js debug mode
docker-compose exec storefront npm run dev -- --debug

# Enable Docker BuildKit debug
BUILDKIT_PROGRESS=plain docker build .
```

### Cleaning Up

```bash
# Remove all containers and volumes
docker-compose down -v --remove-orphans

# Remove all images
docker-compose down --rmi all

# Prune Docker system
docker system prune -a --volumes

# Reset everything (WARNING: deletes all Docker data)
docker system prune -a --volumes --force
```

## Best Practices

### Development

1. **Always use Docker for consistent environment**
2. **Keep `.env` file secure and never commit it**
3. **Run tests before committing**
4. **Use `--profile tools` for database inspection**
5. **Monitor logs regularly during development**

### Production

1. **Use multi-stage builds for smaller images**
2. **Implement proper health checks**
3. **Use secrets management for sensitive data**
4. **Enable monitoring and logging**
5. **Regular security scans with Snyk**
6. **Keep base images updated**

### CI/CD

1. **All tests must pass before merge**
2. **Use semantic versioning for releases**
3. **Review security scan results**
4. **Monitor build times and optimize**
5. **Keep dependencies updated**

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright Documentation](https://playwright.dev/)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review GitHub Actions logs
3. Check Docker logs: `docker-compose logs`
4. Open an issue in the repository
