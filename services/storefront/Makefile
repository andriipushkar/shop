# ===========================================
# Makefile for TechShop Storefront
# Simplified Docker and development commands
# ===========================================

.PHONY: help install dev build start stop restart logs clean test lint

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(BLUE)TechShop Storefront - Available Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""

##@ Development

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm ci
	npx prisma generate
	@echo "$(GREEN)Dependencies installed!$(NC)"

dev: ## Start development server (without Docker)
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

build: ## Build Next.js application
	@echo "$(BLUE)Building application...$(NC)"
	npm run build
	@echo "$(GREEN)Build complete!$(NC)"

start: ## Start production server (without Docker)
	@echo "$(BLUE)Starting production server...$(NC)"
	npm start

##@ Docker - Development

docker-dev: ## Start all services in development mode
	@echo "$(BLUE)Starting Docker development environment...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "$(YELLOW)Storefront: http://localhost:3000$(NC)"
	@make docker-logs

docker-dev-build: ## Build and start development services
	@echo "$(BLUE)Building and starting development environment...$(NC)"
	docker-compose up -d --build
	@echo "$(GREEN)Services started!$(NC)"

docker-dev-tools: ## Start development with management tools
	@echo "$(BLUE)Starting with management tools...$(NC)"
	docker-compose --profile tools up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "$(YELLOW)Storefront: http://localhost:3000$(NC)"
	@echo "$(YELLOW)Adminer: http://localhost:8080$(NC)"
	@echo "$(YELLOW)Redis Commander: http://localhost:8081$(NC)"

##@ Docker - Production

docker-prod: ## Start production services
	@echo "$(BLUE)Starting production environment...$(NC)"
	docker-compose --profile production up -d
	@echo "$(GREEN)Production services started!$(NC)"
	@echo "$(YELLOW)Production: http://localhost:3001$(NC)"

docker-prod-full: ## Start production with nginx
	@echo "$(BLUE)Starting full production stack...$(NC)"
	docker-compose --profile production up -d
	@echo "$(GREEN)Full stack started!$(NC)"
	@echo "$(YELLOW)Nginx: http://localhost$(NC)"
	@echo "$(YELLOW)Direct: http://localhost:3001$(NC)"

##@ Docker - Control

docker-stop: ## Stop all Docker services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down
	@echo "$(GREEN)Services stopped!$(NC)"

docker-restart: ## Restart all services
	@echo "$(BLUE)Restarting services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)Services restarted!$(NC)"

docker-rebuild: ## Rebuild all Docker images
	@echo "$(BLUE)Rebuilding all images...$(NC)"
	docker-compose build --no-cache
	@echo "$(GREEN)Images rebuilt!$(NC)"

docker-logs: ## Show logs from all services
	docker-compose logs -f

docker-logs-app: ## Show logs from storefront only
	docker-compose logs -f storefront

docker-logs-db: ## Show logs from database
	docker-compose logs -f db

docker-logs-redis: ## Show logs from Redis
	docker-compose logs -f redis

##@ Docker - Database

db-migrate: ## Run Prisma migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	docker-compose exec storefront npx prisma migrate dev
	@echo "$(GREEN)Migrations complete!$(NC)"

db-migrate-deploy: ## Deploy migrations (production)
	@echo "$(BLUE)Deploying migrations...$(NC)"
	docker-compose exec storefront npx prisma migrate deploy
	@echo "$(GREEN)Migrations deployed!$(NC)"

db-seed: ## Seed the database
	@echo "$(BLUE)Seeding database...$(NC)"
	docker-compose exec storefront npx prisma db seed
	@echo "$(GREEN)Database seeded!$(NC)"

db-studio: ## Open Prisma Studio
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	docker-compose exec storefront npx prisma studio

db-reset: ## Reset database (WARNING: deletes all data)
	@echo "$(RED)WARNING: This will delete all database data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose exec storefront npx prisma migrate reset --force; \
		echo "$(GREEN)Database reset!$(NC)"; \
	fi

db-shell: ## Access PostgreSQL shell
	docker-compose exec db psql -U postgres -d storefront

##@ Docker - Cache

redis-cli: ## Access Redis CLI
	docker-compose exec redis redis-cli

redis-monitor: ## Monitor Redis commands
	docker-compose exec redis redis-cli monitor

redis-flush: ## Flush all Redis data (WARNING: deletes all cache)
	@echo "$(RED)WARNING: This will delete all cached data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose exec redis redis-cli flushall; \
		echo "$(GREEN)Redis flushed!$(NC)"; \
	fi

##@ Testing

test: ## Run unit tests
	@echo "$(BLUE)Running unit tests...$(NC)"
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npm run test:coverage

test-e2e: ## Run E2E tests
	@echo "$(BLUE)Running E2E tests...$(NC)"
	npm run test:e2e

test-e2e-ui: ## Run E2E tests with UI
	npm run test:e2e:ui

##@ Code Quality

lint: ## Run ESLint
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

lint-fix: ## Fix linting issues
	@echo "$(BLUE)Fixing linting issues...$(NC)"
	npm run lint -- --fix

type-check: ## Run TypeScript type checking
	@echo "$(BLUE)Running type check...$(NC)"
	npx tsc --noEmit

format: ## Format code with Prettier (if available)
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format || echo "Prettier not configured"

##@ Cleanup

clean: ## Clean build artifacts and caches
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf .next
	rm -rf node_modules/.cache
	rm -rf coverage
	rm -rf test-results
	rm -rf playwright-report
	@echo "$(GREEN)Clean complete!$(NC)"

clean-all: ## Clean everything including node_modules
	@echo "$(RED)Cleaning everything...$(NC)"
	rm -rf .next
	rm -rf node_modules
	rm -rf coverage
	rm -rf test-results
	rm -rf playwright-report
	@echo "$(GREEN)Complete clean done!$(NC)"

docker-clean: ## Remove all Docker containers and volumes
	@echo "$(RED)WARNING: This will remove all containers and volumes!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v --remove-orphans; \
		echo "$(GREEN)Docker cleaned!$(NC)"; \
	fi

docker-prune: ## Prune Docker system (free up space)
	@echo "$(BLUE)Pruning Docker system...$(NC)"
	docker system prune -f
	@echo "$(GREEN)Docker pruned!$(NC)"

##@ Utilities

shell: ## Access storefront container shell
	docker-compose exec storefront sh

status: ## Show status of all services
	@echo "$(BLUE)Service Status:$(NC)"
	docker-compose ps

health: ## Check health of all services
	@echo "$(BLUE)Health Status:$(NC)"
	@docker-compose ps --format json | jq -r '.[] | "\(.Service): \(.Health)"' || docker-compose ps

env-check: ## Verify environment variables
	@echo "$(BLUE)Checking environment variables...$(NC)"
	@test -f .env && echo "$(GREEN).env file exists$(NC)" || echo "$(RED).env file missing! Copy from .env.docker$(NC)"
	@docker-compose exec storefront env | grep -E 'DATABASE_URL|REDIS_URL|NEXTAUTH' || true

backup-db: ## Backup PostgreSQL database
	@echo "$(BLUE)Backing up database...$(NC)"
	docker-compose exec -T db pg_dump -U postgres storefront > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Database backed up!$(NC)"

restore-db: ## Restore PostgreSQL database from backup
	@echo "$(RED)WARNING: This will replace current database!$(NC)"
	@read -p "Enter backup file name: " backup; \
	if [ -f "$$backup" ]; then \
		docker-compose exec -T db psql -U postgres storefront < "$$backup"; \
		echo "$(GREEN)Database restored!$(NC)"; \
	else \
		echo "$(RED)Backup file not found!$(NC)"; \
	fi

##@ CI/CD

ci-test: ## Run full CI test suite locally
	@echo "$(BLUE)Running full CI test suite...$(NC)"
	npm run lint
	npx tsc --noEmit
	npm run test:coverage
	npm run build
	@echo "$(GREEN)CI tests passed!$(NC)"

docker-build-prod: ## Build production Docker image
	@echo "$(BLUE)Building production Docker image...$(NC)"
	docker build -t storefront:latest --target runner .
	@echo "$(GREEN)Production image built!$(NC)"

docker-tag: ## Tag Docker image for registry
	@read -p "Enter tag version: " version; \
	docker tag storefront:latest storefront:$$version; \
	echo "$(GREEN)Image tagged as storefront:$$version$(NC)"
