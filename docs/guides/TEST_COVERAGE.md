# Test Coverage

Налаштування та моніторинг тестового покриття.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TEST COVERAGE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Coverage Types:                                                            │
│  ├── Line Coverage      - % виконаних рядків коду                          │
│  ├── Branch Coverage    - % виконаних гілок (if/else)                      │
│  ├── Function Coverage  - % викликаних функцій                             │
│  └── Statement Coverage - % виконаних виразів                              │
│                                                                              │
│  Targets:                                                                   │
│  ├── Backend (Go)    - 80% minimum                                         │
│  ├── Frontend (TS)   - 75% minimum                                         │
│  └── Critical paths  - 90% minimum                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Backend Coverage (Go)

### Running Coverage

```bash
# Run tests with coverage
go test -v -race -coverprofile=coverage.out ./...

# Generate HTML report
go tool cover -html=coverage.out -o coverage.html

# View coverage summary
go tool cover -func=coverage.out

# Coverage by package
go test -coverprofile=coverage.out -coverpkg=./... ./...
```

### Coverage Configuration

```go
// Makefile
.PHONY: test-coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
	go tool cover -func=coverage.out | grep total
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

.PHONY: coverage-check
coverage-check:
	@echo "Checking coverage threshold..."
	@coverage=$$(go tool cover -func=coverage.out | grep total | awk '{print $$3}' | sed 's/%//'); \
	if [ $$(echo "$$coverage < 80" | bc) -eq 1 ]; then \
		echo "Coverage $$coverage% is below threshold 80%"; \
		exit 1; \
	fi
	@echo "Coverage check passed!"
```

### Excluding Files

```go
// coverage.ignore
// These files are excluded from coverage:

// Generated code
**/generated/*.go
**/*_gen.go

// Test utilities
**/testutil/*.go
**/*_test.go

// Main entry points
**/cmd/*/main.go

// Wire dependency injection
wire_gen.go
```

## Frontend Coverage (TypeScript)

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/*',
        '**/generated/*',
      ],
      thresholds: {
        lines: 75,
        branches: 70,
        functions: 75,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Running Coverage

```bash
# Run tests with coverage
npm run test -- --coverage

# Watch mode with coverage
npm run test -- --coverage --watch

# Coverage for specific files
npm run test -- --coverage --coverage.include="src/components/**"
```

### Jest Configuration (Alternative)

```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    './src/components/checkout/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};
```

## Coverage Reports

### Codecov Integration

```yaml
# .github/workflows/coverage.yml
name: Coverage

on:
  push:
    branches: [main]
  pull_request:

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Run Go tests with coverage
        run: |
          go test -race -coverprofile=coverage-go.out -covermode=atomic ./...

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run frontend tests with coverage
        run: npm run test -- --coverage

      - name: Upload to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage-go.out,./coverage/lcov.info
          flags: backend,frontend
          fail_ci_if_error: true
```

### codecov.yml

```yaml
# codecov.yml
coverage:
  precision: 2
  round: down
  range: "70...100"

  status:
    project:
      default:
        target: 80%
        threshold: 2%
    patch:
      default:
        target: 80%
        threshold: 5%

parsers:
  gcov:
    branch_detection:
      conditional: yes
      loop: yes
      method: no
      macro: no

comment:
  layout: "reach,diff,flags,files"
  behavior: default
  require_changes: true

flags:
  backend:
    paths:
      - services/core/
    carryforward: true
  frontend:
    paths:
      - services/storefront/
    carryforward: true
```

## Coverage Thresholds

### By Component

| Component | Lines | Branches | Functions |
|-----------|-------|----------|-----------|
| Core API | 85% | 80% | 85% |
| Payment | 90% | 85% | 90% |
| Auth | 90% | 85% | 90% |
| UI Components | 75% | 70% | 75% |
| Utils | 80% | 75% | 80% |

### Critical Paths

```yaml
# Critical paths require 90%+ coverage
critical_paths:
  - src/services/payment/
  - src/services/auth/
  - src/services/checkout/
  - internal/payment/
  - internal/auth/
  - internal/order/
```

## Improving Coverage

### Identifying Gaps

```bash
# Go: Find untested packages
go test -coverprofile=coverage.out ./... 2>&1 | grep "no test files"

# Go: Find low coverage packages
go tool cover -func=coverage.out | sort -k3 -n | head -20

# TypeScript: Uncovered lines
npm run test -- --coverage --coverageReporters=text-summary
```

### Writing Effective Tests

```go
// Good: Tests edge cases
func TestCalculateDiscount(t *testing.T) {
    tests := []struct {
        name     string
        amount   float64
        discount float64
        want     float64
    }{
        {"no discount", 100, 0, 100},
        {"10% discount", 100, 10, 90},
        {"100% discount", 100, 100, 0},
        {"negative amount", -100, 10, -90},
        {"large amount", 1000000, 15, 850000},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := CalculateDiscount(tt.amount, tt.discount)
            if got != tt.want {
                t.Errorf("CalculateDiscount(%v, %v) = %v, want %v",
                    tt.amount, tt.discount, got, tt.want)
            }
        })
    }
}
```

```typescript
// Good: Tests component states
describe('Button', () => {
  it('renders default state', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('renders disabled state', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders loading state', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## Coverage in PR Reviews

### PR Coverage Comment

```yaml
# Example PR comment from Codecov
Coverage Report
---
| Totals | |
|--------|-------|
| Change from base | +0.5% |
| Patch coverage | 85.2% |

| Files | Coverage |
|-------|----------|
| src/components/Cart.tsx | 92% |
| src/hooks/useCart.ts | 78% |
| internal/order/service.go | 88% |
```

### Coverage Gates

```yaml
# Block merge if coverage drops
status:
  project:
    default:
      target: auto
      threshold: 1%  # Allow 1% drop
      if_ci_failed: error
  patch:
    default:
      target: 80%
      if_ci_failed: error
```

## Local Coverage Tools

### VS Code Extensions

- **Coverage Gutters** - Shows coverage in editor
- **Jest Runner** - Run tests with coverage inline

### Configuration

```json
// .vscode/settings.json
{
  "coverage-gutters.coverageFileNames": [
    "lcov.info",
    "coverage.lcov",
    "coverage.out"
  ],
  "coverage-gutters.showLineCoverage": true,
  "coverage-gutters.showRulerCoverage": true
}
```

## See Also

- [Testing Guide](./TESTING.md)
- [Integration Testing](./INTEGRATION_TESTING.md)
- [E2E Testing](./E2E_TESTING.md)
