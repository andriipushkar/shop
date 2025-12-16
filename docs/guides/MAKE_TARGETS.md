# Make Targets

Документація Makefile команд проекту.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAKE TARGETS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Development:        Testing:            Build:              Deploy:        │
│  ├── make dev       ├── make test       ├── make build      ├── make deploy│
│  ├── make setup     ├── make test-e2e   ├── make docker     ├── make helm  │
│  ├── make install   ├── make lint       ├── make release    ├── make k8s   │
│  └── make clean     └── make coverage   └── make package    └── make rollback│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Reference

```bash
# Most common commands
make dev          # Start development environment
make test         # Run all tests
make build        # Build all services
make deploy       # Deploy to staging
```

## Full Makefile

```makefile
# Makefile
.PHONY: help dev setup build test deploy clean

# Variables
PROJECT_NAME := shop-platform
GO_VERSION := 1.21
NODE_VERSION := 18
DOCKER_REGISTRY := ghcr.io/shop
VERSION := $(shell git describe --tags --always --dirty)

# Colors
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

#==============================================================================
# HELP
#==============================================================================

help: ## Show this help
	@echo "$(GREEN)$(PROJECT_NAME)$(NC) - Available targets:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make $(YELLOW)<target>$(NC)\n\n"} \
		/^[a-zA-Z_-]+:.*?##/ { printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

#==============================================================================
# DEVELOPMENT
#==============================================================================

.PHONY: dev setup install clean

dev: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	docker-compose up -d postgres redis rabbitmq elasticsearch
	@echo "Waiting for services..."
	@sleep 5
	@make -j2 dev-backend dev-frontend

dev-backend: ## Start backend services
	@echo "$(GREEN)Starting backend...$(NC)"
	cd services/core && air

dev-frontend: ## Start frontend services
	@echo "$(GREEN)Starting frontend...$(NC)"
	cd services/storefront && npm run dev

setup: ## Initial project setup
	@echo "$(GREEN)Setting up project...$(NC)"
	@make install
	@make docker-build
	@make db-setup
	@echo "$(GREEN)Setup complete!$(NC)"

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install backend dependencies
	@echo "$(GREEN)Installing Go dependencies...$(NC)"
	cd services/core && go mod download
	cd services/oms && go mod download
	cd services/crm && go mod download

install-frontend: ## Install frontend dependencies
	@echo "$(GREEN)Installing Node dependencies...$(NC)"
	cd services/storefront && npm ci
	cd services/admin && npm ci

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning...$(NC)"
	rm -rf services/core/bin
	rm -rf services/storefront/.next
	rm -rf services/storefront/node_modules/.cache
	rm -rf coverage/
	docker-compose down -v --remove-orphans

#==============================================================================
# BUILD
#==============================================================================

.PHONY: build build-backend build-frontend docker-build

build: build-backend build-frontend ## Build all services

build-backend: ## Build backend services
	@echo "$(GREEN)Building backend...$(NC)"
	cd services/core && CGO_ENABLED=0 go build -ldflags="-s -w -X main.version=$(VERSION)" -o bin/core ./cmd/core
	cd services/oms && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/oms ./cmd/oms
	cd services/crm && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/crm ./cmd/crm

build-frontend: ## Build frontend services
	@echo "$(GREEN)Building frontend...$(NC)"
	cd services/storefront && npm run build
	cd services/admin && npm run build

docker-build: ## Build Docker images
	@echo "$(GREEN)Building Docker images...$(NC)"
	docker build -t $(DOCKER_REGISTRY)/core:$(VERSION) services/core
	docker build -t $(DOCKER_REGISTRY)/storefront:$(VERSION) services/storefront
	docker build -t $(DOCKER_REGISTRY)/admin:$(VERSION) services/admin
	docker build -t $(DOCKER_REGISTRY)/oms:$(VERSION) services/oms

docker-push: ## Push Docker images
	@echo "$(GREEN)Pushing Docker images...$(NC)"
	docker push $(DOCKER_REGISTRY)/core:$(VERSION)
	docker push $(DOCKER_REGISTRY)/storefront:$(VERSION)
	docker push $(DOCKER_REGISTRY)/admin:$(VERSION)
	docker push $(DOCKER_REGISTRY)/oms:$(VERSION)

#==============================================================================
# TESTING
#==============================================================================

.PHONY: test test-backend test-frontend test-e2e test-integration lint coverage

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	@echo "$(GREEN)Running backend tests...$(NC)"
	cd services/core && go test -v -race ./...

test-frontend: ## Run frontend tests
	@echo "$(GREEN)Running frontend tests...$(NC)"
	cd services/storefront && npm test

test-e2e: ## Run E2E tests
	@echo "$(GREEN)Running E2E tests...$(NC)"
	npx playwright test

test-integration: ## Run integration tests
	@echo "$(GREEN)Running integration tests...$(NC)"
	docker-compose -f docker-compose.test.yml up -d
	cd services/core && go test -v -tags=integration ./...
	docker-compose -f docker-compose.test.yml down

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint backend code
	@echo "$(GREEN)Linting backend...$(NC)"
	cd services/core && golangci-lint run
	cd services/oms && golangci-lint run

lint-frontend: ## Lint frontend code
	@echo "$(GREEN)Linting frontend...$(NC)"
	cd services/storefront && npm run lint
	cd services/admin && npm run lint

coverage: ## Generate coverage report
	@echo "$(GREEN)Generating coverage report...$(NC)"
	cd services/core && go test -coverprofile=coverage.out ./...
	cd services/core && go tool cover -html=coverage.out -o coverage.html
	cd services/storefront && npm run test -- --coverage

#==============================================================================
# DATABASE
#==============================================================================

.PHONY: db-setup db-migrate db-seed db-reset

db-setup: db-migrate db-seed ## Setup database

db-migrate: ## Run database migrations
	@echo "$(GREEN)Running migrations...$(NC)"
	cd services/core && go run ./cmd/migrate up

db-migrate-down: ## Rollback last migration
	@echo "$(YELLOW)Rolling back migration...$(NC)"
	cd services/core && go run ./cmd/migrate down 1

db-migrate-create: ## Create new migration (usage: make db-migrate-create name=add_users)
	@echo "$(GREEN)Creating migration: $(name)$(NC)"
	cd services/core && go run ./cmd/migrate create $(name)

db-seed: ## Seed database with test data
	@echo "$(GREEN)Seeding database...$(NC)"
	cd services/core && go run ./cmd/seed

db-reset: ## Reset database
	@echo "$(RED)Resetting database...$(NC)"
	docker-compose exec postgres psql -U shop -c "DROP DATABASE IF EXISTS shop_dev"
	docker-compose exec postgres psql -U shop -c "CREATE DATABASE shop_dev"
	@make db-setup

#==============================================================================
# CODE GENERATION
#==============================================================================

.PHONY: generate generate-api generate-mocks

generate: generate-api generate-mocks ## Generate all code

generate-api: ## Generate API code from OpenAPI
	@echo "$(GREEN)Generating API code...$(NC)"
	oapi-codegen -generate types -package api docs/api/openapi.yaml > services/core/internal/api/types.gen.go
	oapi-codegen -generate chi-server -package api docs/api/openapi.yaml > services/core/internal/api/server.gen.go

generate-mocks: ## Generate test mocks
	@echo "$(GREEN)Generating mocks...$(NC)"
	cd services/core && mockgen -source=internal/repository/interfaces.go -destination=internal/mocks/repository_mock.go
	cd services/core && mockgen -source=internal/service/interfaces.go -destination=internal/mocks/service_mock.go

generate-prisma: ## Generate Prisma client
	@echo "$(GREEN)Generating Prisma client...$(NC)"
	cd services/storefront && npx prisma generate

#==============================================================================
# DEPLOYMENT
#==============================================================================

.PHONY: deploy deploy-staging deploy-production rollback

deploy: deploy-staging ## Deploy to default environment (staging)

deploy-staging: ## Deploy to staging
	@echo "$(GREEN)Deploying to staging...$(NC)"
	helm upgrade --install shop-staging deploy/helm/shop-platform \
		-f deploy/helm/shop-platform/values-staging.yaml \
		-n staging \
		--set global.image.tag=$(VERSION) \
		--wait

deploy-production: ## Deploy to production (requires confirmation)
	@echo "$(RED)WARNING: Deploying to PRODUCTION!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	helm upgrade --install shop-prod deploy/helm/shop-platform \
		-f deploy/helm/shop-platform/values-production.yaml \
		-n production \
		--set global.image.tag=$(VERSION) \
		--wait --timeout 15m

rollback: ## Rollback last deployment
	@echo "$(YELLOW)Rolling back deployment...$(NC)"
	helm rollback shop-staging -n staging

rollback-production: ## Rollback production deployment
	@echo "$(RED)Rolling back PRODUCTION...$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	helm rollback shop-prod -n production

#==============================================================================
# KUBERNETES
#==============================================================================

.PHONY: k8s-logs k8s-shell k8s-status

k8s-logs: ## View pod logs (usage: make k8s-logs pod=core)
	kubectl logs -f deployment/shop-staging-$(pod) -n staging

k8s-shell: ## Shell into pod (usage: make k8s-shell pod=core)
	kubectl exec -it deployment/shop-staging-$(pod) -n staging -- /bin/sh

k8s-status: ## Show cluster status
	@echo "$(GREEN)Pods:$(NC)"
	kubectl get pods -n staging
	@echo "\n$(GREEN)Services:$(NC)"
	kubectl get svc -n staging
	@echo "\n$(GREEN)Ingress:$(NC)"
	kubectl get ingress -n staging

k8s-port-forward: ## Forward ports for local access
	kubectl port-forward svc/shop-staging-core 8080:80 -n staging &
	kubectl port-forward svc/shop-staging-storefront 3000:80 -n staging &

#==============================================================================
# UTILITIES
#==============================================================================

.PHONY: docs format version

docs: ## Generate documentation
	@echo "$(GREEN)Generating documentation...$(NC)"
	cd services/core && swag init -g cmd/core/main.go
	cd services/storefront && npm run docs

format: ## Format all code
	@echo "$(GREEN)Formatting code...$(NC)"
	cd services/core && gofmt -s -w .
	cd services/storefront && npm run format

version: ## Show current version
	@echo "Version: $(VERSION)"

#==============================================================================
# CI/CD
#==============================================================================

.PHONY: ci ci-lint ci-test ci-build

ci: ci-lint ci-test ci-build ## Run full CI pipeline

ci-lint: ## CI lint step
	@make lint

ci-test: ## CI test step
	@make test
	@make test-integration

ci-build: ## CI build step
	@make build
	@make docker-build
```

## Usage Examples

### Daily Development

```bash
# Start your day
make dev

# After making changes
make lint
make test

# Before committing
make format
make lint
make test
```

### Database Operations

```bash
# Create new migration
make db-migrate-create name=add_product_categories

# Apply migrations
make db-migrate

# Rollback if needed
make db-migrate-down

# Reset everything
make db-reset
```

### Deployment

```bash
# Build and push
make docker-build
make docker-push

# Deploy to staging
make deploy-staging

# If everything is OK, deploy to production
make deploy-production

# If something goes wrong
make rollback
```

### Debugging

```bash
# Check cluster status
make k8s-status

# View logs
make k8s-logs pod=core

# Shell into container
make k8s-shell pod=core

# Forward ports for local testing
make k8s-port-forward
```

## Environment Variables

```bash
# Override defaults
DOCKER_REGISTRY=my-registry.io make docker-build
VERSION=v1.2.3 make deploy-staging
```

## See Also

- [Development Setup](./DEVELOPMENT_SETUP.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Deployment Guide](../deployment/KUBERNETES.md)
