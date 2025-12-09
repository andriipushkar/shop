.PHONY: all test build clean coverage lint docker-build docker-up docker-down help run-core run-bot

# Default target
all: test build

# Help
help:
	@echo "Shop Microservices - Available targets:"
	@echo ""
	@echo "  make test          - Run all tests"
	@echo "  make test-core     - Run Core service tests"
	@echo "  make test-oms      - Run OMS service tests"
	@echo "  make test-bot      - Run Telegram Bot tests"
	@echo "  make test-crm      - Run CRM service tests"
	@echo "  make test-notif    - Run Notification service tests"
	@echo ""
	@echo "  make build         - Build all services"
	@echo "  make build-core    - Build Core service"
	@echo "  make build-oms     - Build OMS service"
	@echo "  make build-bot     - Build Telegram Bot"
	@echo "  make build-crm     - Build CRM service"
	@echo "  make build-notif   - Build Notification service"
	@echo ""
	@echo "  make coverage      - Generate coverage reports"
	@echo "  make lint          - Run linter on all services"
	@echo ""
	@echo "  make docker-build  - Build Docker images"
	@echo "  make docker-up     - Start all services with Docker Compose"
	@echo "  make docker-down   - Stop all services"
	@echo ""
	@echo "  make clean         - Clean build artifacts"

# Test targets
test: test-core test-oms test-bot test-crm test-notif
	@echo "All tests passed!"

test-core:
	@echo "Testing Core service..."
	@cd services/core && go test -v -race ./...

test-oms:
	@echo "Testing OMS service..."
	@cd services/oms && go test -v -race ./...

test-bot:
	@echo "Testing Telegram Bot..."
	@cd services/telegram-bot && go test -v -race ./...

test-crm:
	@echo "Testing CRM service..."
	@cd services/crm && go test -v -race ./...

test-notif:
	@echo "Testing Notification service..."
	@cd services/notification && go test -v -race ./...

test-integration:
	@echo "Running integration tests..."
	@go test -v -tags=integration ./tests/...

# Build targets
build: build-core build-oms build-bot build-crm build-notif
	@echo "All services built!"

build-core:
	@echo "Building Core service..."
	@cd services/core && go build -o core ./cmd/main.go

build-oms:
	@echo "Building OMS service..."
	@cd services/oms && go build -o oms ./cmd/main.go

build-bot:
	@echo "Building Telegram Bot..."
	@cd services/telegram-bot && go build -o telegram-bot ./cmd/main.go

build-crm:
	@echo "Building CRM service..."
	@cd services/crm && go build -o crm ./cmd/main.go

build-notif:
	@echo "Building Notification service..."
	@cd services/notification && go build -o notification ./cmd/main.go

# Coverage
coverage:
	@echo "Generating coverage reports..."
	@./scripts/coverage.sh

coverage-html:
	@echo "Opening coverage reports..."
	@xdg-open coverage/core-coverage.html 2>/dev/null || open coverage/core-coverage.html 2>/dev/null || echo "Open coverage/*.html manually"

# Lint
lint:
	@echo "Running linter..."
	@cd services/core && golangci-lint run || true
	@cd services/oms && golangci-lint run || true
	@cd services/telegram-bot && golangci-lint run || true
	@cd services/crm && golangci-lint run || true
	@cd services/notification && golangci-lint run || true

# Docker
docker-build:
	@echo "Building Docker images..."
	@docker compose build

docker-up:
	@echo "Starting services..."
	@docker compose up -d
	@echo "Services started!"
	@docker compose ps

docker-down:
	@echo "Stopping services..."
	@docker compose down

docker-logs:
	@docker compose logs -f

docker-restart: docker-down docker-up

# Clean
clean:
	@echo "Cleaning..."
	@rm -f services/core/core
	@rm -f services/oms/oms
	@rm -f services/telegram-bot/telegram-bot
	@rm -f services/crm/crm
	@rm -f services/notification/notification
	@rm -rf coverage/
	@rm -f services/*/coverage.out
	@echo "Clean complete!"

# Development helpers (kept from original)
run-core:
	cd services/core && go run cmd/main.go

run-bot:
	cd services/telegram-bot && go run cmd/main.go

dev-core:
	@cd services/core && go run ./cmd/main.go

dev-oms:
	@cd services/oms && go run ./cmd/main.go

dev-bot:
	@cd services/telegram-bot && go run ./cmd/main.go

# Check dependencies
deps:
	@echo "Downloading dependencies..."
	@cd services/core && go mod download
	@cd services/oms && go mod download
	@cd services/telegram-bot && go mod download
	@cd services/crm && go mod download
	@cd services/notification && go mod download
	@echo "Dependencies downloaded!"

# Tidy modules
tidy:
	@echo "Tidying modules..."
	@cd services/core && go mod tidy
	@cd services/oms && go mod tidy
	@cd services/telegram-bot && go mod tidy
	@cd services/crm && go mod tidy
	@cd services/notification && go mod tidy
	@echo "Modules tidied!"
