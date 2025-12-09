#!/bin/bash

# Coverage Report Generator
# Generates test coverage reports for all services

set -e

SERVICES=("core" "oms" "telegram-bot" "crm" "notification")
COVERAGE_DIR="coverage"
ROOT_DIR=$(pwd)

echo "==================================="
echo "  Shop Microservices Coverage Report"
echo "==================================="
echo ""

# Create coverage directory
mkdir -p $COVERAGE_DIR

total_coverage=0
service_count=0

for service in "${SERVICES[@]}"; do
    SERVICE_DIR="services/$service"

    if [ ! -d "$SERVICE_DIR" ]; then
        echo "⚠️  Service $service not found, skipping..."
        continue
    fi

    echo "📊 Testing $service..."
    cd "$ROOT_DIR/$SERVICE_DIR"

    # Run tests with coverage
    if go test -coverprofile=coverage.out -covermode=atomic ./... 2>/dev/null; then
        # Get coverage percentage
        coverage=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')

        if [ -n "$coverage" ]; then
            echo "   ✅ Coverage: ${coverage}%"

            # Generate HTML report
            go tool cover -html=coverage.out -o "$ROOT_DIR/$COVERAGE_DIR/${service}-coverage.html" 2>/dev/null || true

            # Copy coverage file
            cp coverage.out "$ROOT_DIR/$COVERAGE_DIR/${service}-coverage.out"

            total_coverage=$(echo "$total_coverage + $coverage" | bc)
            ((service_count++))
        else
            echo "   ⚠️  No coverage data"
        fi
    else
        echo "   ❌ Tests failed or no tests found"
    fi

    cd "$ROOT_DIR"
    echo ""
done

# Calculate average coverage
if [ $service_count -gt 0 ]; then
    avg_coverage=$(echo "scale=2; $total_coverage / $service_count" | bc)
    echo "==================================="
    echo "📈 Average Coverage: ${avg_coverage}%"
    echo "==================================="
    echo ""
    echo "HTML reports generated in $COVERAGE_DIR/"
    echo ""

    # List all reports
    ls -la $COVERAGE_DIR/*.html 2>/dev/null || echo "No HTML reports generated"
else
    echo "No services tested successfully"
fi
