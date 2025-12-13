#!/bin/bash

# ===========================================
# Setup Verification Script
# Verifies Docker and CI/CD configuration
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}TechShop Setup Verification${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Function to check if file exists
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $file (missing)"
        ((FAILED++))
        return 1
    fi
}

# Function to check if directory exists
check_dir() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description: $dir"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $dir (missing)"
        ((FAILED++))
        return 1
    fi
}

# Function to check if command exists
check_command() {
    local cmd=$1
    local description=$2

    if command -v "$cmd" &> /dev/null; then
        local version=$($cmd --version 2>&1 | head -n1)
        echo -e "${GREEN}✓${NC} $description: $cmd ($version)"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $description: $cmd (not found)"
        ((WARNINGS++))
        return 1
    fi
}

echo -e "${BLUE}Checking Docker Files...${NC}"
check_file "Dockerfile" "Dockerfile"
check_file "docker-compose.yml" "Docker Compose"
check_file "docker-compose.test.yml" "Test Compose"
check_file ".dockerignore" "Docker Ignore"
check_file ".env.docker" "Docker Environment Template"
echo ""

echo -e "${BLUE}Checking CI/CD Workflows...${NC}"
check_file ".github/workflows/ci.yml" "CI Pipeline"
check_file ".github/workflows/e2e.yml" "E2E Tests"
echo ""

echo -e "${BLUE}Checking Application Files...${NC}"
check_file "app/api/health/route.ts" "Health Endpoint"
check_file "package.json" "Package Configuration"
check_file "tsconfig.json" "TypeScript Config"
echo ""

echo -e "${BLUE}Checking Documentation...${NC}"
check_file "README-DOCKER.md" "Docker Documentation"
check_file "QUICKSTART.md" "Quick Start Guide"
check_file "DOCKER-CICD-SETUP.md" "Setup Summary"
check_file "Makefile" "Make Commands"
echo ""

echo -e "${BLUE}Checking Required Tools...${NC}"
check_command "docker" "Docker"
check_command "docker-compose" "Docker Compose"
check_command "node" "Node.js"
check_command "npm" "npm"
check_command "make" "Make"
check_command "git" "Git"
echo ""

echo -e "${BLUE}Checking Docker Compose Syntax...${NC}"
if docker-compose config &> /dev/null; then
    echo -e "${GREEN}✓${NC} docker-compose.yml syntax is valid"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} docker-compose.yml has syntax errors"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Checking Environment Setup...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} .env file not found (copy from .env.docker)"
    ((WARNINGS++))
fi
echo ""

echo -e "${BLUE}Checking Docker Installation...${NC}"
if docker info &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker daemon is running"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Docker daemon is not running"
    ((FAILED++))
fi
echo ""

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Passed:   $PASSED${NC}"
echo -e "${RED}Failed:   $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Copy environment file: cp .env.docker .env"
    echo "2. Start services: make docker-dev-tools"
    echo "3. Run migrations: make db-migrate"
    echo "4. Seed database: make db-seed"
    echo ""
    echo "Or run: make help"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi
